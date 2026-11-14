import type { CategoryKey } from './categories'

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
  photos: Photo[]
}

export interface MemoryInput {
  title: string
  note?: string
  startDate: string
  endDate?: string | null
  datePrecision?: DatePrecision
  category?: CategoryKey
}

export interface YearSummary {
  year: number
  total: number
  /** Twelve entries, January first: number of memories filed under each month. */
  months: number[]
}

export interface TimelineSummary {
  years: YearSummary[]
}

export interface StatusResponse {
  /** False until the first account has created the shared space. */
  initialized: boolean
  memberCount: number
  me: Member | null
  members: Member[]
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
