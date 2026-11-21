import { useEffect, useRef, useState } from 'react'
import { Image, View } from '@tarojs/components'
import { isOnThisDay, todayLocal, type Memory, type StatusResponse } from '@days/shared'
import { api, photoUrl } from '../api/client'
import { chestIcons } from '../assets/manifest'
import { reducedMotion } from '../browser/sprites'
import type { Translate } from '../i18n'
import { memberName } from '../state/session'
import { Button, Dialog, Icon, formatDate } from './index'
import { Portrait } from './Characters'

/** How long the closed lid is shown before the memory appears. */
const OPEN_MS = 600

/** The line said above a flashback, such as "On this day 3 years ago…". */
export function flashbackLine(t: Translate, m: Memory, today = todayLocal()): string {
  if (isOnThisDay(m.startDate, m.datePrecision, today)) {
    const n = Number(today.slice(0, 4)) - Number(m.startDate.slice(0, 4))
    return n === 1 ? t('chest.yearAgo') : t('chest.yearsAgo', { n })
  }
  return m.datePrecision === 'month'
    ? t('chest.inMonth', { date: formatDate(m.startDate, 'month') })
    : t('chest.onDay', { date: formatDate(m.startDate, 'day') })
}

type ChestState = { phase: 'closed' } | { phase: 'open'; memory: Memory | null } | { phase: 'failed' }

/**
 * The treasure chest: opens a dialogue with one memory picked at random,
 * preferring memories from this day in an earlier year.
 */
export function ChestDialog(props: { status: StatusResponse | null; t: Translate; onOpenMemory: (id: number) => void; onClose: () => void }) {
  const { t } = props
  const [state, setState] = useState<ChestState>({ phase: 'closed' })
  const attempt = useRef(0)

  const draw = () => {
    const mine = ++attempt.current
    setState({ phase: 'closed' })
    const wait = new Promise((resolve) => setTimeout(resolve, reducedMotion() ? 0 : OPEN_MS))
    Promise.all([api.flashback(todayLocal()), wait]).then(
      ([r]) => {
        if (attempt.current === mine) setState({ phase: 'open', memory: r.memory })
      },
      () => {
        if (attempt.current === mine) setState({ phase: 'failed' })
      },
    )
  }

  useEffect(draw, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => void attempt.current++, [])

  const memory = state.phase === 'open' ? state.memory : null
  const open = state.phase === 'open'

  return (
    <Dialog
      title={t('chest.title')}
      onClose={props.onClose}
      actions={
        <>
          <Button kind="plain" onClick={props.onClose} testId="chest-close">{t('common.close')}</Button>
          {memory ? (
            <>
              <Button onClick={draw} testId="chest-another">{t('chest.another')}</Button>
              <Button kind="primary" onClick={() => props.onOpenMemory(memory.id)} testId="chest-open-memory">{t('chest.open')}</Button>
            </>
          ) : null}
        </>
      }
    >
      <View className={`chest-lid ${open && memory ? 'open' : ''}`} data-testid={`chest-${open && memory ? 'open' : 'closed'}`}>
        <Icon src={open && memory ? chestIcons.open : chestIcons.closed} size={48} />
      </View>
      {state.phase === 'closed' ? <View className="muted small center">{t('chest.opening')}</View> : null}
      {state.phase === 'failed' ? <View className="muted small center">{t('error.generic')}</View> : null}
      {open && !memory ? <View className="muted small center" data-testid="chest-empty">{t('chest.empty')}</View> : null}
      {memory ? (
        <View data-testid="chest-memory">
          <View className="dialogue">
            <Portrait status={props.status} memberId={memory.createdBy} />
            <View className="grow">
              <View className="who">
                <View className="name">{memberName(props.status, memory.createdBy)}</View>
              </View>
              <View className="text" data-testid="chest-line">{flashbackLine(t, memory)}</View>
            </View>
          </View>
          {memory.photos.length > 0 ? (
            <View className="px-frame chest-cover">
              <Image className="cover-img" src={photoUrl(memory.photos[0].id, 'medium')} mode="aspectFill" />
            </View>
          ) : null}
          <View className="chest-title" data-testid="chest-title">{memory.title}</View>
        </View>
      ) : null}
    </Dialog>
  )
}
