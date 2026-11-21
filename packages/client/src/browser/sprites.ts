// Sprite layer for the partners and the pet. Browser-only: actors are plain
// DOM elements animated by one shared timer, so that walking does not cause
// React renders. Sheet layout: docs/asset-spec.md, Section 4.
import type { CharacterSheet, Look } from '../assets/manifest'

export type Facing = 'down' | 'left' | 'right' | 'up'
export type Motion = 'idle' | 'walk'

const FACING_ROW: Record<Facing, number> = { down: 0, left: 1, right: 2, up: 3 }
const FRAMES: Record<Motion, number> = { idle: 2, walk: 4 }
const FRAME_MS: Record<Motion, number> = { idle: 500, walk: 125 }
/** Upper limit of one walk, in milliseconds. */
export const WALK_MS = 600

/** The whole-number enlargement closest to `target` screen pixels of height. */
export function spriteScale(sheet: CharacterSheet, target = 48): number {
  return Math.max(1, Math.round(target / sheet.frameHeight))
}

export function reducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

const layersOf = (look: CharacterSheet | Look): Look => (Array.isArray(look) ? look : [look])

/** Background position of one frame, repeated for every layer. */
function position(layers: number, w: number, h: number, row: number, column: number): string {
  return new Array(layers).fill(`-${column * w}px -${row * h}px`).join(', ')
}

/**
 * CSS for showing one frame of a sheet, or of several sheets drawn over one
 * another (bottom first), as element backgrounds.
 */
export function frameStyle(look: CharacterSheet | Look, scale: number, row = 0, column = 0): Record<string, string> {
  const layers = layersOf(look)
  const w = layers[0].frameWidth * scale
  const h = layers[0].frameHeight * scale
  const each = (v: string) => new Array(layers.length).fill(v).join(', ')
  return {
    width: `${w}px`,
    height: `${h}px`,
    // The first CSS background is drawn on top.
    backgroundImage: [...layers].reverse().map((l) => `url("${l.src}")`).join(', '),
    backgroundSize: each(`${w * 4}px ${h * 8}px`),
    backgroundPosition: position(layers.length, w, h, row, column),
    backgroundRepeat: each('no-repeat'),
  }
}

// ---- shared timer ----

const live = new Set<Actor>()
let timer: number | null = null

function tick(): void {
  const now = performance.now()
  live.forEach((a) => a.draw(now))
}

function track(actor: Actor): void {
  live.add(actor)
  if (timer === null) timer = window.setInterval(tick, FRAME_MS.walk)
}

function untrack(actor: Actor): void {
  live.delete(actor)
  if (live.size === 0 && timer !== null) {
    window.clearInterval(timer)
    timer = null
  }
}

/** One animated character. */
export class Actor {
  readonly el: HTMLDivElement
  private motion: Motion = 'idle'
  private facing: Facing = 'down'
  private since = performance.now()
  private shown = ''

  constructor(
    private look: Look,
    private scale: number,
  ) {
    this.el = document.createElement('div')
    this.el.className = 'actor'
    Object.assign(this.el.style, frameStyle(look, scale))
    this.draw(this.since)
    track(this)
  }

  set(motion: Motion, facing: Facing = this.facing): void {
    if (motion === this.motion && facing === this.facing) return
    this.motion = motion
    this.facing = facing
    this.since = performance.now()
    this.draw(this.since)
  }

  draw(now: number): void {
    const still = reducedMotion()
    const frames = FRAMES[this.motion]
    const column = still ? 0 : Math.floor((now - this.since) / FRAME_MS[this.motion]) % frames
    const row = FACING_ROW[this.facing] + (this.motion === 'walk' ? 4 : 0)
    const key = `${row}:${column}`
    if (key === this.shown) return
    this.shown = key
    const w = this.look[0].frameWidth * this.scale
    const h = this.look[0].frameHeight * this.scale
    this.el.style.backgroundPosition = position(this.look.length, w, h, row, column)
  }

  destroy(): void {
    untrack(this)
    this.el.remove()
  }
}

/**
 * The two partners and the pet standing side by side. A speech bubble can be
 * shown above any one of them.
 */
export class Party {
  readonly el: HTMLDivElement
  private actors: Actor[]
  private slots: HTMLDivElement[]
  private bubble: HTMLDivElement | null = null

  /** One look per character: its body sheet, then any overlays. */
  constructor(looks: Look[]) {
    this.el = document.createElement('div')
    this.el.className = 'party'
    this.el.setAttribute('data-testid', 'party')
    const scale = Math.min(...looks.map((l) => spriteScale(l[0])))
    this.actors = looks.map((l) => new Actor(l, scale))
    this.slots = this.actors.map((a) => {
      const slot = document.createElement('div')
      slot.className = 'party-slot'
      slot.appendChild(a.el)
      this.el.appendChild(slot)
      return slot
    })
  }

  set(motion: Motion, facing?: Facing): void {
    this.actors.forEach((a) => a.set(motion, facing))
  }

  /** Shows `text` in a bubble above actor `index`; `onClick` makes it tappable. */
  say(index: number, text: string, onClick?: () => void): void {
    this.hush()
    const b = document.createElement('div')
    b.className = onClick ? 'bubble link' : 'bubble'
    b.setAttribute('data-testid', 'bubble')
    b.textContent = text
    if (onClick) {
      b.addEventListener('click', (e) => {
        e.stopPropagation()
        onClick()
      })
    }
    this.slots[Math.max(0, Math.min(index, this.slots.length - 1))].appendChild(b)
    this.bubble = b
  }

  hush(): void {
    this.bubble?.remove()
    this.bubble = null
  }

  speaking(): boolean {
    return this.bubble !== null
  }

  destroy(): void {
    this.actors.forEach((a) => a.destroy())
    this.el.remove()
  }
}

/** The facing for a movement by (dx, dy) in screen pixels. */
export function facingFor(dx: number, dy: number): Facing {
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? 'left' : 'right'
  return dy < 0 ? 'up' : 'down'
}

/**
 * Runs `step(t)` for t from 0 to 1 over `ms` milliseconds, then `done()`.
 * Returns a function that stops it at once (without calling `done`).
 */
export function tween(ms: number, step: (t: number) => void, done: () => void): () => void {
  if (ms <= 0 || reducedMotion()) {
    step(1)
    done()
    return () => undefined
  }
  const start = performance.now()
  let frame = 0
  let stopped = false
  const run = (now: number) => {
    if (stopped) return
    const t = Math.min(1, (now - start) / ms)
    step(t)
    if (t < 1) frame = requestAnimationFrame(run)
    else done()
  }
  frame = requestAnimationFrame(run)
  return () => {
    stopped = true
    cancelAnimationFrame(frame)
  }
}

/** Walk duration for a distance in screen pixels: brisk, never above WALK_MS. */
export function walkMs(distance: number): number {
  return Math.min(WALK_MS, Math.max(200, distance * 2))
}
