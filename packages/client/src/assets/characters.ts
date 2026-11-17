/**
 * Placeholder sprite sheets for the two partners and the pet, generated from
 * small drawings. The layout follows docs/asset-spec.md, Section 4: four
 * columns and eight rows (idle, then walk; facing down, left, right, up).
 * Final art replaces these through `manifest.ts`.
 */
import { pixelSvg } from './pixel'

type Grid = string[]
const SIZE = 16
const EMPTY_ROW = '.'.repeat(SIZE)

function check(grid: Grid): Grid {
  for (const row of grid) if (row.length !== SIZE) throw new Error(`sprite row has ${row.length} pixels: ${row}`)
  return grid
}

const mirror = (grid: Grid): Grid => grid.map((r) => [...r].reverse().join(''))
/** Moves the drawing up by `n` rows (the walk cycle's bounce). */
const lift = (grid: Grid, n: number): Grid => [...grid.slice(n), ...new Array(n).fill(EMPTY_ROW)]
const recolor = (grid: Grid, colors: Record<string, string>): Grid =>
  grid.map((r) => [...r].map((ch) => colors[ch] ?? ch).join(''))

// ---- partners: head (8 rows) + body (4 rows) + legs (3 rows), 1 empty row on top ----

const HEAD = {
  down: ['.....kkkkkk.....', '....kHHHHHHk....', '...kHHHHHHHHk...', '...kHppppppHk...', '...kpEppppEpk...', '...kppppppppk...', '....kppmmppk....', '.....kkkkkk.....'],
  up: ['.....kkkkkk.....', '....kHHHHHHk....', '...kHHHHHHHHk...', '...kHHHHHHHHk...', '...kHHHHHHHHk...', '...kHHHHHHHHk...', '....kHHHHHHk....', '.....kkkkkk.....'],
  left: ['.....kkkkkk.....', '....kHHHHHHk....', '...kHHHHHHHHk...', '...kppHHHHHHk...', '...kEpppHHHHk...', '...kppppHHHHk...', '....kpppHHHk....', '.....kkkkkk.....'],
}
const BODY = {
  front: ['....kSSSSSSk....', '...kpSSSSSSpk...', '...kpSSSSSSpk...', '....kSSSSSSk....'],
  side: ['.....kSSSSk.....', '.....kSSSSk.....', '.....kSpSSk.....', '.....kSSSSk.....'],
}
const LEGS = {
  stand: ['.....kLLLLk.....', '.....kLkkLk.....', '.....kk..kk.....'],
  apart: ['.....kLLLLk.....', '....kLk..kLk....', '....kk....kk....'],
  together: ['.....kLLLLk.....', '......kLLk......', '......kkkk......'],
  stride: ['.....kLLLLk.....', '....kLk..kLk....', '...kk......kk...'],
}

type Facing = 'down' | 'left' | 'right' | 'up'
const FACINGS: Facing[] = ['down', 'left', 'right', 'up']

function partnerFrame(facing: Facing, legs: Grid, blink = false): Grid {
  const head = facing === 'up' ? HEAD.up : facing === 'down' ? HEAD.down : HEAD.left
  const body = facing === 'down' || facing === 'up' ? BODY.front : BODY.side
  let grid = check([EMPTY_ROW, ...head, ...body, ...legs])
  if (blink) grid = recolor(grid, { E: 'p' })
  return facing === 'right' ? mirror(grid) : grid
}

function partnerRows(): Grid[][] {
  const idle = FACINGS.map((f) => [partnerFrame(f, LEGS.stand), partnerFrame(f, LEGS.stand, true)])
  const walk = FACINGS.map((f) => {
    const step = f === 'down' || f === 'up' ? [LEGS.apart, LEGS.together] : [LEGS.stride, LEGS.stand]
    return [partnerFrame(f, step[0]), lift(partnerFrame(f, step[1]), 1), partnerFrame(f, step[0]), lift(partnerFrame(f, step[1]), 1)]
  })
  return [...idle, ...walk]
}

// ---- pet: a small cat on the bottom nine rows ----

const PET = {
  down: ['......k....k....', '.....kyk..kyk...', '.....kyyyyyyk...', '.....kyEyyEyk...', '.....kyymmyyk...', '......kyyyyk....', '.....kyyyyyyk...', '.....kyyyyyyk...'],
  up: ['......k....k....', '.....kyk..kyk...', '.....kyyyyyyk...', '.....kyyyyyyk...', '.....kyyyyyyk...', '......kyyyyk..k.', '.....kyyyyyykyk.', '.....kyyyyyyk...'],
  left: ['................', '..k.k...........', '.kykyk.......k..', '.kEyyk......kyk.', '.kyyyykkkkkkyk..', '..kyyyyyyyyyk...', '...kyyyyyyyk....', '...kyyyyyyyk....'],
}
const PET_LEGS = {
  front: ['.....kyk..kyk...'],
  frontStep: ['.....kk....kk...'],
  side: ['...kyk...kyk....'],
  sideStep: ['..kyk.....kyk...'],
}

function petFrame(facing: Facing, legs: Grid, blink = false): Grid {
  const body = facing === 'up' ? PET.up : facing === 'down' ? PET.down : PET.left
  let grid = check([...new Array(SIZE - body.length - legs.length).fill(EMPTY_ROW), ...body, ...legs])
  if (blink) grid = recolor(grid, { E: 'y' })
  return facing === 'right' ? mirror(grid) : grid
}

function petRows(): Grid[][] {
  const idle = FACINGS.map((f) => {
    const legs = f === 'down' || f === 'up' ? PET_LEGS.front : PET_LEGS.side
    return [petFrame(f, legs), petFrame(f, legs, true)]
  })
  const walk = FACINGS.map((f) => {
    const [a, b] = f === 'down' || f === 'up' ? [PET_LEGS.front, PET_LEGS.frontStep] : [PET_LEGS.side, PET_LEGS.sideStep]
    return [petFrame(f, a), lift(petFrame(f, b), 1), petFrame(f, a), lift(petFrame(f, b), 1)]
  })
  return [...idle, ...walk]
}

/** Joins frames into one sheet of 4 columns; missing frames stay transparent. */
function sheet(rows: Grid[][]): string {
  const lines: string[] = []
  for (const frames of rows) {
    for (let y = 0; y < SIZE; y++) {
      let line = ''
      for (let c = 0; c < 4; c++) line += frames[c]?.[y] ?? EMPTY_ROW
      lines.push(line.replace(/E/g, 'k'))
    }
  }
  return pixelSvg(lines)
}

export const placeholderSheets = {
  'partner-a': sheet(partnerRows().map((row) => row.map((g) => recolor(g, { H: 'n', S: 'r', L: 'b' })))),
  'partner-b': sheet(partnerRows().map((row) => row.map((g) => recolor(g, { H: 'k', S: 'g', L: 's' })))),
  pet: sheet(petRows()),
}
export const PLACEHOLDER_FRAME_SIZE = SIZE
