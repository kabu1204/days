// Browser-only: registers the pixel typeface (Fusion Pixel Font, SIL OFL 1.1).
import fontUrl from '@fontsource/fusion-pixel-12px-proportional-sc/files/fusion-pixel-12px-proportional-sc-latin-400-normal.woff2'

export const PIXEL_FONT_FAMILY = 'Fusion Pixel 12px'

export function installPixelFont(): void {
  if (typeof document === 'undefined' || document.getElementById('days-font')) return
  const style = document.createElement('style')
  style.id = 'days-font'
  style.textContent = `@font-face{font-family:'${PIXEL_FONT_FAMILY}';src:url(${fontUrl}) format('woff2');font-weight:400;font-style:normal;font-display:swap;}`
  document.head.appendChild(style)
}
