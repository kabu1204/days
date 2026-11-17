import { useEffect, useRef } from 'react'
import { View } from '@tarojs/components'
import { planBubbles, todayLocal, type Bubble, type Member, type StatusResponse } from '@days/shared'
import { api } from '../api/client'
import { characterSheets, type CharacterKey, type CharacterSheet } from '../assets/manifest'
import { Party, facingFor, frameStyle, spriteScale, tween, walkMs } from '../browser/sprites'
import type { Translate } from '../i18n'
import { cx } from '.'

export const PET_ID = 0

export function characterKey(slot: 1 | 2): CharacterKey {
  return slot === 1 ? 'partner-a' : 'partner-b'
}

/** The party in display order: members by slot, then the pet. */
export function partyMembers(status: StatusResponse | null): { id: number; sheet: CharacterSheet }[] {
  const members = [...(status?.members ?? [])].sort((a, b) => a.slot - b.slot)
  return [
    ...members.map((m: Member) => ({ id: m.id, sheet: characterSheets[characterKey(m.slot)] })),
    { id: PET_ID, sheet: characterSheets.pet },
  ]
}

/** The first idle frame facing the viewer, used next to dialogue lines and reactions. */
export function Portrait(props: { status: StatusResponse | null; memberId: number; size?: 'small' | 'normal'; className?: string }) {
  const member = props.status?.members.find((m) => m.id === props.memberId)
  const sheet = member ? characterSheets[characterKey(member.slot)] : characterSheets.pet
  const scale = props.size === 'small' ? Math.max(1, spriteScale(sheet, 24)) : spriteScale(sheet, 48)
  return <View className={cx('portrait', props.className)} style={frameStyle(sheet, scale)} />
}

// ---- speech bubbles ----

/** Lines planned once per visit of the application, and how far they have been read. */
const talk: { list: Bubble[] | null; next: number; greeted: boolean; loading: Promise<Bubble[]> | null } = {
  list: null,
  next: 0,
  greeted: false,
  loading: null,
}

export function loadBubbles(): Promise<Bubble[]> {
  if (talk.list) return Promise.resolve(talk.list)
  if (!talk.loading) {
    const today = todayLocal()
    talk.loading = api
      .bubbles(today)
      .then((sources) => planBubbles(sources, today, new Date().getHours()))
      .catch(() => planBubbles({ keyDates: [], onThisDay: [], quotes: [] }, today, new Date().getHours()))
      .then((list) => {
        talk.list = list
        talk.loading = null
        return list
      })
  }
  return talk.loading
}

/** Called after key dates change, so that the next visit plans again. */
export function forgetBubbles(): void {
  talk.list = null
  talk.next = 0
}

export function bubbleText(t: Translate, b: Bubble): string {
  switch (b.kind) {
    case 'keyDateToday':
      return b.years > 0 ? t('bubble.keyDateToday', { label: b.label, n: b.years }) : t('bubble.keyDateTodayFirst', { label: b.label })
    case 'keyDateSoon':
      return b.days === 1 ? t('bubble.keyDateTomorrow', { label: b.label }) : t('bubble.keyDateSoon', { label: b.label, n: b.days })
    case 'onThisDay':
      return b.years === 1 ? t('bubble.onThisDay1', { title: b.title }) : t('bubble.onThisDay', { title: b.title, n: b.years })
    case 'quote':
      return t('bubble.quote', { text: b.text })
    case 'everyday':
      return t(`bubble.${b.period}.${b.line}` as 'bubble.day.1')
  }
}

/** Who says a line: key dates by the viewer, memories by their author, everyday lines by the pet. */
export function speakerOf(b: Bubble, meId: number): number {
  if (b.kind === 'keyDateToday' || b.kind === 'keyDateSoon') return meId
  if (b.kind === 'onThisDay' || b.kind === 'quote') return b.speakerId
  return PET_ID
}

const BUBBLE_MS = 8000

/**
 * The party standing above the month ruler. `position` is the selected
 * month (0-11); the party walks there. Tapping the party shows the next line.
 */
export function PartyStage(props: {
  status: StatusResponse | null
  meId: number
  position: number
  t: Translate
  onOpenMemory: (id: number) => void
}) {
  const host = useRef<HTMLElement | null>(null)
  const party = useRef<Party | null>(null)
  const x = useRef<number | null>(null)
  const stop = useRef<() => void>(() => undefined)
  const hushTimer = useRef<number | null>(null)
  const members = partyMembers(props.status)
  const order = members.map((m) => m.id)
  const latest = useRef(props)
  latest.current = props

  const speak = (b: Bubble) => {
    const p = party.current
    if (!p) return
    const index = order.indexOf(speakerOf(b, latest.current.meId))
    const memoryId = b.kind === 'onThisDay' || b.kind === 'quote' ? b.memoryId : null
    p.say(index >= 0 ? index : order.length - 1, bubbleText(latest.current.t, b), memoryId !== null ? () => latest.current.onOpenMemory(memoryId) : undefined)
    if (hushTimer.current !== null) window.clearTimeout(hushTimer.current)
    hushTimer.current = window.setTimeout(() => p.hush(), BUBBLE_MS)
  }

  const speakNext = () => {
    loadBubbles().then((list) => {
      if (!list.length) return
      speak(list[talk.next % list.length])
      talk.next++
    })
  }

  // The party is created once per set of characters.
  const key = order.join(',')
  useEffect(() => {
    const el = host.current
    if (!el) return
    const p = new Party(members.map((m) => m.sheet))
    p.el.addEventListener('click', () => (p.speaking() ? p.hush() : speakNext()))
    el.appendChild(p.el)
    party.current = p
    x.current = null
    if (!talk.greeted) {
      talk.greeted = true
      speakNext()
    }
    return () => {
      stop.current()
      if (hushTimer.current !== null) window.clearTimeout(hushTimer.current)
      p.destroy()
      party.current = null
    }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  // Walk to the selected month; a new selection interrupts the walk.
  useEffect(() => {
    const el = host.current
    const p = party.current
    if (!el || !p) return
    const width = el.clientWidth
    const own = p.el.offsetWidth
    const target = Math.max(0, Math.min(width - own, (width * (props.position + 0.5)) / 12 - own / 2))
    stop.current()
    // Bubbles open towards the middle of the stage.
    p.el.dataset.side = target + own / 2 > width / 2 ? 'right' : 'left'
    const from = x.current
    if (from === null || Math.abs(target - from) < 1) {
      x.current = target
      p.el.style.transform = `translateX(${target}px)`
      return
    }
    p.set('walk', facingFor(target - from, 0))
    stop.current = tween(
      walkMs(Math.abs(target - from)),
      (t) => {
        x.current = from + (target - from) * t
        p.el.style.transform = `translateX(${x.current}px)`
      },
      () => p.set('idle', 'down'),
    )
    return () => {
      // An interrupted walk leaves the party where it stands, facing down.
      p.set('idle', 'down')
    }
  }, [props.position, key])

  return <View className="stage" data-testid="stage" ref={host as any} />
}
