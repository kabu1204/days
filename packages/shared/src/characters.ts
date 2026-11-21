/** Headpieces a partner can wear; each member chooses one (stored as `spriteId`). */
export const HEADPIECE_KEYS = ['rosette', 'top-hat', 'chef-hat', 'cat-ears'] as const
export type HeadpieceKey = (typeof HEADPIECE_KEYS)[number]

export function isHeadpieceKey(v: unknown): v is HeadpieceKey {
  return typeof v === 'string' && (HEADPIECE_KEYS as readonly string[]).includes(v)
}

/** The headpiece a member wears until they choose one. */
export function defaultHeadpiece(slot: 1 | 2): HeadpieceKey {
  return slot === 1 ? 'rosette' : 'top-hat'
}
