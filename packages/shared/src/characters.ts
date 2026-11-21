/**
 * Bodies a partner can have: round mochi (rice-cake) creatures named after
 * Japanese sweets. Each member chooses one (stored as `bodyId`).
 */
export const BODY_KEYS = ['cream', 'peach', 'sakura', 'matcha', 'kinako', 'sesame'] as const
export type BodyKey = (typeof BODY_KEYS)[number]

export function isBodyKey(v: unknown): v is BodyKey {
  return typeof v === 'string' && (BODY_KEYS as readonly string[]).includes(v)
}

/** The body a member has until they choose one. */
export function defaultBody(slot: 1 | 2): BodyKey {
  return slot === 1 ? 'cream' : 'peach'
}

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
