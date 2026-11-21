/** Pixel grids: arrays of equal-length strings of palette keys; '.' is transparent. */
export type Grid = string[]

export function blank(w: number, h: number): Grid {
  return new Array(h).fill('.'.repeat(w))
}

export function size(g: Grid): { w: number; h: number } {
  return { w: g[0]?.length ?? 0, h: g.length }
}

export function check(g: Grid, w: number, h: number, name = 'grid'): Grid {
  if (g.length !== h) throw new Error(`${name}: ${g.length} rows, expected ${h}`)
  g.forEach((row, i) => {
    if (row.length !== w) throw new Error(`${name}: row ${i} has ${row.length} pixels, expected ${w}: "${row}"`)
  })
  return g
}

export const mirror = (g: Grid): Grid => g.map((r) => [...r].reverse().join(''))

export const recolor = (g: Grid, map: Record<string, string>): Grid => g.map((r) => [...r].map((ch) => map[ch] ?? ch).join(''))

/** Draws `top` over `base` with its top-left corner at (x, y); transparent pixels are skipped. */
export function stamp(base: Grid, top: Grid, x: number, y: number): Grid {
  const out = base.map((r) => [...r])
  top.forEach((row, ty) => {
    const by = y + ty
    if (by < 0 || by >= out.length) return
    ;[...row].forEach((ch, tx) => {
      const bx = x + tx
      if (ch === '.' || bx < 0 || bx >= out[by].length) return
      out[by][bx] = ch
    })
  })
  return out.map((r) => r.join(''))
}

/** Centres a drawing in a w × h grid (extra pixels go right and down). */
export function fit(g: Grid, w: number, h: number): Grid {
  const s = size(g)
  return stamp(blank(w, h), g.map((r) => r.padEnd(s.w, '.')), Math.floor((w - s.w) / 2), Math.floor((h - s.h) / 2))
}

/** Joins frames (rows of up to `columns` frames of equal size) into one sheet. */
export function sheet(rows: Grid[][], columns: number, fw: number, fh: number): Grid {
  const lines: string[] = []
  for (const frames of rows) {
    for (let y = 0; y < fh; y++) {
      let line = ''
      for (let c = 0; c < columns; c++) line += frames[c]?.[y] ?? '.'.repeat(fw)
      lines.push(line)
    }
  }
  return lines
}

/** Adds an outline of `key` around every opaque pixel (4-neighbourhood), outside the drawing. */
export function outline(g: Grid, key = 'k'): Grid {
  const { w, h } = size(g)
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? '.' : g[y][x])
  return g.map((row, y) =>
    [...row]
      .map((ch, x) => (ch !== '.' ? ch : [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)].some((n) => n !== '.') ? key : '.'))
      .join(''),
  )
}
