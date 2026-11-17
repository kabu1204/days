// Browser-only: small page helpers that have no Taro equivalent on H5.

/**
 * Scrolls the element with the given id to the middle of the view, vertically
 * only. (`scrollIntoView` would also scroll sideways while a new page is still
 * sliding in.)
 */
export function scrollToId(id: string): void {
  // The element may be rendered in the next frame.
  requestAnimationFrame(() => {
    const el = document.getElementById(id)
    if (!el) return
    for (let box = el.parentElement; box && box !== document.body; box = box.parentElement) {
      const overflow = getComputedStyle(box).overflowY
      if ((overflow === 'auto' || overflow === 'scroll') && box.scrollHeight > box.clientHeight) {
        const offset = el.getBoundingClientRect().top - box.getBoundingClientRect().top
        box.scrollTop += offset - box.clientHeight / 2 + el.offsetHeight / 2
      }
    }
    const rect = el.getBoundingClientRect()
    window.scrollTo({ top: window.scrollY + rect.top - window.innerHeight / 2 + rect.height / 2, behavior: 'smooth' })
  })
}
