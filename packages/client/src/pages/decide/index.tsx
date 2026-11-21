import { useEffect, useRef, useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { WISH_TEXT_MAX_LENGTH, type WishItem, type WishKind } from '@days/shared'
import { ApiFailure, api } from '../../api/client'
import { pointerIcon } from '../../assets/manifest'
import { reducedMotion } from '../../browser/sprites'
import { errorText, useT, type Translate } from '../../i18n'
import { ROUTES, useMember } from '../../state/session'
import { Button, Frame, Icon, TextInput, TopBar, cx } from '../../ui'

/** Length of the card shuffle and of the wheel spin. */
const DRAW_MS = 1200
const SHUFFLE_STEP_MS = 90
const SPIN_MS = 2600
const SPIN_TRANSITION = `transform ${SPIN_MS}ms cubic-bezier(0.15, 0.85, 0.2, 1)`
/** Segment colours of the wheel, from the palette. */
const WHEEL_COLOURS = ['var(--gold)', 'var(--card)', 'var(--accent-2)', 'var(--paper-2)', 'var(--accent)', 'var(--paper)']
/** Labels are left out when the segments become too narrow to hold them. */
const WHEEL_LABEL_LIMIT = 10

/** Opens the memory editor prefilled from a wish. */
function makeMemory(w: WishItem): void {
  const category = w.kind === 'food' ? 'food' : 'travel'
  Taro.navigateTo({ url: `${ROUTES.edit}?wishId=${w.id}&title=${encodeURIComponent(w.text)}&category=${category}` })
}

/**
 * Date decision tools: a card draw for where to go and a wheel for what to
 * eat, both drawing from the shared wish list.
 */
export default function DecidePage() {
  const t = useT()
  const me = useMember()
  const [kind, setKind] = useState<WishKind>('destination')
  const [wishes, setWishes] = useState<WishItem[] | null>(null)

  const reload = () => api.wishes().then((r) => setWishes(r.wishes), () => setWishes((w) => w ?? []))
  useDidShow(() => {
    reload()
  })

  if (!me || !wishes) return <View className="page muted">{t('common.loading')}</View>

  const ofKind = wishes.filter((w) => w.kind === kind)
  const open = ofKind.filter((w) => w.doneMemoryId === null)
  const granted = ofKind.filter((w) => w.doneMemoryId !== null)

  return (
    <View className="page">
      <TopBar title={t('decide.title')} back />
      <View className="row tabs">
        {(['destination', 'food'] as const).map((k) => (
          <Button key={k} small selected={k === kind} onClick={() => setKind(k)} testId={`tab-${k}`}>
            {t(`decide.${k}`)}
          </Button>
        ))}
      </View>

      <Frame tone="paper">
        <View className="small muted" style={{ marginBottom: '9px' }}>{t(`decide.${kind}.text`)}</View>
        {kind === 'destination' ? <CardDraw key="draw" t={t} wishes={open} /> : <FoodWheel key="wheel" t={t} wishes={open} />}
      </Frame>

      <WishList t={t} kind={kind} open={open} granted={granted} onChange={reload} />
    </View>
  )
}

/** The chosen wish with the button that turns it into a memory. */
function Result(props: { t: Translate; wish: WishItem }) {
  return (
    <View className="decide-result">
      <View data-testid="decide-result">{props.t('decide.result', { text: props.wish.text })}</View>
      <Button kind="primary" onClick={() => makeMemory(props.wish)} testId="make-memory">{props.t('decide.makeMemory')}</Button>
    </View>
  )
}

function useTimers() {
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  return {
    later(ms: number, fn: () => void) {
      timers.current.push(setTimeout(fn, ms))
    },
    clear() {
      timers.current.forEach(clearTimeout)
      timers.current = []
    },
  }
}

function CardDraw(props: { t: Translate; wishes: WishItem[] }) {
  const { t, wishes } = props
  const [shown, setShown] = useState<string | null>(null)
  const [result, setResult] = useState<WishItem | null>(null)
  const [busy, setBusy] = useState(false)
  const timers = useTimers()
  const enough = wishes.length >= 2

  // A change of the list makes an earlier result out of date.
  const ids = wishes.map((w) => w.id).join(',')
  useEffect(() => {
    timers.clear()
    setBusy(false)
    setResult(null)
    setShown(null)
  }, [ids]) // eslint-disable-line react-hooks/exhaustive-deps

  const draw = () => {
    const chosen = wishes[Math.floor(Math.random() * wishes.length)]
    setResult(null)
    if (reducedMotion()) {
      setShown(chosen.text)
      setResult(chosen)
      return
    }
    setBusy(true)
    const steps = Math.floor(DRAW_MS / SHUFFLE_STEP_MS)
    for (let i = 0; i < steps; i++) {
      timers.later(i * SHUFFLE_STEP_MS, () => setShown(wishes[(i + Math.floor(Math.random() * wishes.length)) % wishes.length].text))
    }
    timers.later(DRAW_MS, () => {
      setShown(chosen.text)
      setResult(chosen)
      setBusy(false)
    })
  }

  return (
    <View>
      <View className={cx('draw-card px-frame', busy && 'shuffling', result && 'drawn')} data-testid="draw-card">
        <Text>{shown ?? '?'}</Text>
      </View>
      {enough ? null : <View className="small muted center">{t('decide.needTwo')}</View>}
      <View className="row center-row">
        <Button disabled={!enough || busy} onClick={draw} testId="decide-go">{result ? t('decide.again') : t('decide.draw')}</Button>
      </View>
      {result && !busy ? <Result t={t} wish={result} /> : null}
    </View>
  )
}

function FoodWheel(props: { t: Translate; wishes: WishItem[] }) {
  const { t, wishes } = props
  const [rotation, setRotation] = useState(0)
  const [animate, setAnimate] = useState(false)
  const [result, setResult] = useState<WishItem | null>(null)
  const [busy, setBusy] = useState(false)
  const timers = useTimers()
  const enough = wishes.length >= 2
  const n = Math.max(wishes.length, 1)
  const step = 360 / n

  const ids = wishes.map((w) => w.id).join(',')
  useEffect(() => {
    timers.clear()
    setBusy(false)
    setResult(null)
  }, [ids]) // eslint-disable-line react-hooks/exhaustive-deps

  const spin = () => {
    const index = Math.floor(Math.random() * wishes.length)
    // Turns the wheel so that the chosen segment stops under the pointer at the top.
    const target = -(index * step + step / 2 + (Math.random() - 0.5) * step * 0.6)
    const base = rotation - (rotation % 360)
    let next = base + target
    while (next <= rotation) next += 360
    const still = reducedMotion()
    setResult(null)
    setAnimate(!still)
    setRotation(still ? next : next + 360 * 4)
    if (still) {
      setResult(wishes[index])
      return
    }
    setBusy(true)
    timers.later(SPIN_MS, () => {
      setResult(wishes[index])
      setBusy(false)
    })
  }

  const gradient = wishes.length
    ? `conic-gradient(${wishes.map((_, i) => `${WHEEL_COLOURS[i % WHEEL_COLOURS.length]} ${i * step}deg ${(i + 1) * step}deg`).join(', ')})`
    : 'var(--paper-2)'

  return (
    <View>
      <View className="wheel-box">
        <Icon src={pointerIcon} size={24} className="wheel-pointer" />
        <View
          className="wheel"
          data-testid="wheel"
          style={{
            background: gradient,
            transform: `rotate(${rotation}deg)`,
            transition: animate ? SPIN_TRANSITION : 'none',
          }}
        >
          {wishes.length <= WHEEL_LABEL_LIMIT
            ? wishes.map((w, i) => (
                <Text
                  key={w.id}
                  className="wheel-label"
                  style={{
                    // The last rotation undoes the wheel's turn, with the same timing, so the text stays upright.
                    transform: `rotate(${i * step + step / 2}deg) translateY(-62px) rotate(${-(i * step + step / 2) - rotation}deg)`,
                    transition: animate ? SPIN_TRANSITION : 'none',
                  }}
                >
                  {w.text}
                </Text>
              ))
            : null}
        </View>
      </View>
      {enough ? null : <View className="small muted center">{t('decide.needTwo')}</View>}
      <View className="row center-row">
        <Button disabled={!enough || busy} onClick={spin} testId="decide-go">{result ? t('decide.again') : t('decide.spin')}</Button>
      </View>
      {result && !busy ? <Result t={t} wish={result} /> : null}
    </View>
  )
}

function WishList(props: { t: Translate; kind: WishKind; open: WishItem[]; granted: WishItem[]; onChange: () => void }) {
  const { t, kind } = props
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError('')
    try {
      await fn()
      props.onChange()
    } catch (err) {
      setError(errorText(t, err instanceof ApiFailure ? err.code : undefined))
    } finally {
      setBusy(false)
    }
  }

  const add = () => {
    const v = text.trim()
    if (!v || busy) return
    run(async () => {
      await api.createWish({ kind, text: v })
      setText('')
    })
  }

  return (
    <Frame className="wish-list">
      <View className="section-title">{t('wish.title')}</View>
      {props.open.length === 0 ? <View className="small muted" data-testid="wish-empty">{t('wish.empty')}</View> : null}
      {props.open.map((w) => (
        <View key={w.id} className="wish-row" data-testid="wish-item">
          <Text className="grow ellipsis" data-testid="wish-text">{w.text}</Text>
          <View className="remove" data-testid="wish-remove" onClick={() => run(() => api.deleteWish(w.id))}>×</View>
        </View>
      ))}
      <View className="say">
        <TextInput name="wish" value={text} onChange={setText} placeholder={t(`wish.${kind}.placeholder`)} maxLength={WISH_TEXT_MAX_LENGTH} />
        <Button disabled={busy || !text.trim()} onClick={add} testId="wish-add">{t('wish.add')}</Button>
      </View>
      {error ? <View className="error-text">{error}</View> : null}
      {props.granted.length ? (
        <>
          <View className="section-title">{t('wish.grantedTitle')}</View>
          {props.granted.map((w) => (
            <View
              key={w.id}
              className="wish-row done"
              data-testid="wish-granted"
              onClick={() => Taro.navigateTo({ url: `${ROUTES.detail}?id=${w.doneMemoryId}` })}
            >
              <Text className="grow ellipsis">{w.text}</Text>
              <Text className="small quiet">{t('wish.granted')}</Text>
            </View>
          ))}
        </>
      ) : null}
    </Frame>
  )
}
