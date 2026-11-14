/**
 * Placeholder pixel art, drawn as character grids and converted to SVG data
 * URIs. Final art replaces the entries in `manifest.ts`; no other file
 * refers to these drawings.
 */
export const PALETTE: Record<string, string> = {
  k: '#2b2233',
  w: '#fffaf0',
  r: '#c8553d',
  y: '#e0a43a',
  g: '#3d7a6a',
  b: '#4a7fb5',
  n: '#8a5a3c',
  p: '#f2c6a0',
  s: '#9a8fa3',
}

/** Converts rows of palette characters ('.' is transparent) into an SVG data URI. */
export function pixelSvg(rows: string[]): string {
  const h = rows.length
  const w = rows[0].length
  let rects = ''
  for (let y = 0; y < h; y++) {
    let x = 0
    while (x < w) {
      const ch = rows[y][x]
      if (ch === '.' || !PALETTE[ch]) {
        x++
        continue
      }
      let run = 1
      while (x + run < w && rows[y][x + run] === ch) run++
      rects += `<rect x="${x}" y="${y}" width="${run}" height="1" fill="${PALETTE[ch]}"/>`
      x += run
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${rects}</svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
