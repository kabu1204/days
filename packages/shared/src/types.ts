import type { CategoryKey } from './categories'
import type { PlaceIconKey } from './places'
import type { StickerKey } from './social'

export type Lang = 'zh-CN' | 'en'
export const LANGS: Lang[] = ['zh-CN', 'en']

export type DatePrecision = 'day' | 'month'
export type PhotoVariant = 'thumb' | 'medium' | 'original'

export interface Member {
  id: number
  slot: 1 | 2
  username: string
  displayName: string
  spriteId: string
  lang: Lang
}

export interface Photo {
  id: number
  memoryId: number
  uploadedBy: number
  /** Local wall-clock time of capture, `YYYY-MM-DDTHH:mm:ss`, without a time zone. */
  takenAt: string | null
  /** WGS-84 */
  latitude: number | null
  longitude: number | null
  sortOrder: number
  width: number
  height: number
  originalName: string
  createdAt: string
}

export interface Memory {
  id: number
  title: string
  note: string
  /** `YYYY-MM-DD`. With month precision the day part is `01`. */
  startDate: string
  endDate: string | null
  datePrecision: DatePrecision
  category: CategoryKey
  createdBy: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  placeId: number | null
  /** The memory's Place, or null. */
  place: PlaceRef | null
  photos: Photo[]
  /** Reactions and decorative stickers. */
  stickers: StickerPlacement[]
  commentCount: number
  /**
   * True when the other member added or changed something in this memory
   * after the requesting member last opened it (the quiet marker).
   */
  unseen: boolean
}

/** A memory with its comments, as shown on the memory page. */
export interface MemoryDetail extends Memory {
  comments: Comment[]
  /** When the requesting member last opened this memory; items by the other member after this time are new. */
  seenAt: string
}

/** A comment, shown as a dialogue box. */
export interface Comment {
  id: number
  memoryId: number
  authorId: number
  text: string
  createdAt: string
}

/** A sticker on a memory. Reactions have no position; decorative stickers have a position on the cover (0–1). */
export interface StickerPlacement {
  id: number
  memoryId: number
  key: StickerKey
  placedBy: number
  x: number | null
  y: number | null
  createdAt: string
}

/** A date that is counted down in speech bubbles, every year. */
export interface KeyDate {
  id: number
  label: string
  date: string
  createdBy: number
}

export interface MemoryInput {
  title: string
  note?: string
  startDate: string
  endDate?: string | null
  datePrecision?: DatePrecision
  category?: CategoryKey
  placeId?: number | null
}

/** The fields of a Place that a memory carries with it. */
export interface PlaceRef {
  id: number
  name: string
  /** WGS-84 */
  latitude: number
  longitude: number
  icon: PlaceIconKey
}

export interface Place extends PlaceRef {
  city: string
  /** Number of memories (not deleted) at this Place. */
  memoryCount: number
  /** Start date of the earliest and of the latest memory at this Place. */
  firstDate: string | null
  lastDate: string | null
}

export interface PlaceInput {
  name: string
  latitude: number
  longitude: number
  city?: string
  icon?: PlaceIconKey
}

export interface YearSummary {
  year: number
  total: number
  /** Twelve entries, January first: number of memories filed under each month. */
  months: number[]
}

export interface TimelineSummary {
  years: YearSummary[]
  /** Months (`YYYY-MM`) with memories that carry the quiet marker for the requesting member. */
  unseenMonths: string[]
}

export interface StatusResponse {
  /** False until the first account has created the shared space. */
  initialized: boolean
  memberCount: number
  me: Member | null
  members: Member[]
  /** Address of the map tile file served by the server, or null when none is installed. */
  mapTiles: string | null
}

export interface PhotoMetaInput {
  takenAt?: string | null
  latitude?: number | null
  longitude?: number | null
}

export interface ApiError {
  error: string
  message?: string
}
