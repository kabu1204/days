import { useEffect, useState, type PropsWithChildren, type ReactNode } from 'react'
import { Image, Input, Text, Textarea, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { daysInMonth, pad2, type CategoryKey, type DatePrecision } from '@days/shared'
import { categoryIcons } from '../assets/manifest'
import { useT } from '../i18n'

function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

export function Frame(props: PropsWithChildren<{ className?: string; tone?: 'paper' | 'ink'; onClick?: () => void }>) {
  return (
    <View className={cx('px-frame', props.tone && `tone-${props.tone}`, props.className)} onClick={props.onClick}>
      {props.children}
    </View>
  )
}

export function Button(
  props: PropsWithChildren<{
    onClick?: () => void
    kind?: 'primary' | 'calm' | 'plain'
    small?: boolean
    block?: boolean
    disabled?: boolean
    selected?: boolean
    className?: string
    testId?: string
  }>,
) {
  return (
    <View
      className={cx('px-btn', props.kind, props.small && 'small', props.block && 'block', props.disabled && 'disabled', props.selected && 'selected', props.className)}
      data-testid={props.testId}
      onClick={(e) => {
        e.stopPropagation()
        if (!props.disabled) props.onClick?.()
      }}
    >
      {props.children}
    </View>
  )
}

export function Icon(props: { src: string; size?: 12 | 24 | 36 | 48; className?: string }) {
  return <Image className={cx('px-icon', props.size && `s${props.size}`, props.className)} src={props.src} mode="scaleToFill" />
}

export function CategoryIcon(props: { category: CategoryKey; size?: 12 | 24 | 36 | 48 }) {
  return <Icon src={categoryIcons[props.category] ?? categoryIcons.other} size={props.size} />
}

export function TopBar(props: PropsWithChildren<{ title: string; back?: boolean | string }>) {
  const goBack = () => {
    if (typeof props.back === 'string') Taro.reLaunch({ url: props.back })
    else if (Taro.getCurrentPages().length > 1) Taro.navigateBack()
    else Taro.reLaunch({ url: '/pages/timeline/index' })
  }
  return (
    <View className="topbar">
      {props.back ? (
        <Button small kind="plain" onClick={goBack} testId="back">
          ◀
        </Button>
      ) : null}
      <Text className="h1 ellipsis">{props.title}</Text>
      {props.children}
    </View>
  )
}

export function Field(props: PropsWithChildren<{ label: string; hint?: string }>) {
  return (
    <View className="px-field">
      <Text className="label">{props.label}</Text>
      {props.children}
      {props.hint ? <Text className="hint">{props.hint}</Text> : null}
    </View>
  )
}

export function TextInput(props: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  password?: boolean
  maxLength?: number
  name?: string
  className?: string
}) {
  return (
    <View className={cx('px-input', props.className)}>
      <Input
        name={props.name}
        value={props.value}
        password={props.password}
        placeholder={props.placeholder}
        maxlength={props.maxLength ?? 140}
        onInput={(e) => props.onChange(e.detail.value)}
      />
    </View>
  )
}

export function TextArea(props: { value: string; onChange: (v: string) => void; placeholder?: string; maxLength?: number; name?: string }) {
  return (
    <View className="px-input area">
      <Textarea
        name={props.name}
        value={props.value}
        placeholder={props.placeholder}
        maxlength={props.maxLength ?? 5000}
        onInput={(e) => props.onChange(e.detail.value)}
      />
    </View>
  )
}

export function Dialog(props: PropsWithChildren<{ title?: string; text?: string; onClose?: () => void; actions?: ReactNode }>) {
  return (
    <View className="px-overlay" onClick={props.onClose}>
      <View className="px-frame px-dialog" onClick={(e) => e.stopPropagation()}>
        {props.title ? <View className="title">{props.title}</View> : null}
        {props.text ? <View className="text">{props.text}</View> : null}
        {props.children}
        {props.actions ? <View className="actions">{props.actions}</View> : null}
      </View>
    </View>
  )
}

export function Confirm(props: { title: string; text?: string; confirmText?: string; danger?: boolean; onConfirm: () => void; onCancel: () => void }) {
  const t = useT()
  return (
    <Dialog
      title={props.title}
      text={props.text}
      onClose={props.onCancel}
      actions={
        <>
          <Button kind="plain" onClick={props.onCancel} testId="confirm-cancel">
            {t('common.cancel')}
          </Button>
          <Button kind={props.danger ? 'primary' : 'calm'} onClick={props.onConfirm} testId="confirm-ok">
            {props.confirmText ?? t('common.confirm')}
          </Button>
        </>
      }
    />
  )
}

export function Progress(props: { done: number; total: number }) {
  const pct = props.total > 0 ? Math.min(100, Math.round((props.done / props.total) * 100)) : 0
  return (
    <View className="px-progress">
      <View className="bar" style={{ width: `${pct}%` }} />
    </View>
  )
}

/** A short message shown above the page; replaces system toasts. */
export function useToast(): [ReactNode, (text: string) => void] {
  const [text, setText] = useState<string | null>(null)
  useEffect(() => {
    if (!text) return
    const timer = setTimeout(() => setText(null), 2600)
    return () => clearTimeout(timer)
  }, [text])
  const node = text ? <View className="px-frame tone-ink px-toast">{text}</View> : null
  return [node, setText]
}

export function formatDate(startDate: string, precision: DatePrecision, endDate?: string | null): string {
  const start = precision === 'month' ? startDate.slice(0, 7) : startDate
  return (endDate ? `${start} – ${endDate}` : start).replace(/-/g, '.').replace(' – ', ' – ')
}

/** A pixel-styled date selector: year stepper, month grid, and day grid. */
export function DateDialog(props: {
  value: string
  precision: DatePrecision
  min?: string
  onPick: (date: string) => void
  onClose: () => void
}) {
  const t = useT()
  const [year, setYear] = useState(Number(props.value.slice(0, 4)))
  const [month, setMonth] = useState(Number(props.value.slice(5, 7)))
  const [day, setDay] = useState(Number(props.value.slice(8, 10)))
  const maxDay = daysInMonth(year, month)
  const safeDay = Math.min(day, maxDay)
  const result = `${year}-${pad2(month)}-${pad2(props.precision === 'month' ? 1 : safeDay)}`
  const invalid = !!props.min && result < props.min

  return (
    <Dialog
      onClose={props.onClose}
      actions={
        <>
          <Button kind="plain" onClick={props.onClose}>
            {t('common.cancel')}
          </Button>
          <Button kind="calm" disabled={invalid} onClick={() => props.onPick(result)} testId="date-ok">
            {t('common.confirm')}
          </Button>
        </>
      }
    >
      <View className="date-year">
        <Button small kind="plain" onClick={() => setYear(year - 10)}>◀◀</Button>
        <Button small kind="plain" onClick={() => setYear(year - 1)} testId="year-prev">◀</Button>
        <Text className="y" data-testid="date-year">{year}</Text>
        <Button small kind="plain" onClick={() => setYear(year + 1)} testId="year-next">▶</Button>
        <Button small kind="plain" onClick={() => setYear(year + 10)}>▶▶</Button>
      </View>
      <View className="date-grid months">
        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
          <View key={m} className={cx('date-cell', m === month && 'selected')} data-testid={`date-month-${m}`} onClick={() => setMonth(m)}>
            {t(`month.${m}` as 'month.1')}
          </View>
        ))}
      </View>
      {props.precision === 'day' ? (
        <View className="date-grid days">
          {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
            <View key={d} className={cx('date-cell', d === safeDay && 'selected')} data-testid={`date-day-${d}`} onClick={() => setDay(d)}>
              {d}
            </View>
          ))}
        </View>
      ) : null}
      <View className="center small muted">{formatDate(result, props.precision)}</View>
    </Dialog>
  )
}

export { cx }
