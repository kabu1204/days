import Taro from '@tarojs/taro'
import type {
  BubbleSources,
  Comment,
  KeyDate,
  BodyKey,
  HeadpieceKey,
  Member,
  Memory,
  MemoryDetail,
  StickerKey,
  StickerPlacement,
  MemoryInput,
  Photo,
  PhotoMetaInput,
  PhotoVariant,
  Place,
  PlaceInput,
  StatusResponse,
  TimelineSummary,
  Lang,
} from '@days/shared'

export class ApiFailure extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code)
  }
}

let onUnauthorized: (() => void) | null = null
export function setUnauthorizedHandler(fn: () => void): void {
  onUnauthorized = fn
}

async function request<T>(method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', url: string, data?: unknown): Promise<T> {
  let res: Taro.request.SuccessCallbackResult<any>
  try {
    res = await Taro.request({
      url,
      method,
      data: data === undefined ? undefined : JSON.stringify(data),
      header: data === undefined ? {} : { 'content-type': 'application/json' },
      dataType: 'json',
    })
  } catch {
    throw new ApiFailure(0, 'network')
  }
  if (res.statusCode >= 200 && res.statusCode < 300) return res.data as T
  if (res.statusCode === 401 && !url.startsWith('/api/session')) onUnauthorized?.()
  throw new ApiFailure(res.statusCode, res.data?.error ?? 'generic')
}

export interface Credentials {
  username: string
  password: string
  displayName: string
}

export interface TrashPhoto extends Photo {
  memoryTitle: string
  deletedAt: string
}

export interface TrashComment extends Comment {
  memoryTitle: string
  deletedAt: string
}

export const api = {
  status: () => request<StatusResponse>('GET', '/api/status'),
  setup: (body: Credentials & { setupToken?: string }) => request<{ ok: true }>('POST', '/api/setup', body),
  signIn: (username: string, password: string) => request<{ ok: true }>('POST', '/api/session', { username, password }),
  signOut: () => request<{ ok: true }>('DELETE', '/api/session'),
  updateMe: (body: { displayName?: string; lang?: Lang; spriteId?: HeadpieceKey; bodyId?: BodyKey }) => request<Member>('PATCH', '/api/me', body),

  checkInvitation: (token: string) => request<{ valid: boolean }>('GET', `/api/invitations/${encodeURIComponent(token)}`),
  acceptInvitation: (token: string, body: Credentials) =>
    request<{ ok: true }>('POST', `/api/invitations/${encodeURIComponent(token)}/accept`, body),
  createInvitation: () => request<{ token: string }>('POST', '/api/invitations'),

  summary: () => request<TimelineSummary>('GET', '/api/timeline/summary'),
  month: (month: string) => request<{ memories: Memory[] }>('GET', `/api/memories?month=${month}`),
  memory: (id: number) => request<MemoryDetail>('GET', `/api/memories/${id}`),
  seen: (id: number) => request<{ ok: true }>('POST', `/api/memories/${id}/seen`),
  createMemory: (body: MemoryInput) => request<Memory>('POST', '/api/memories', body),
  updateMemory: (id: number, body: Partial<MemoryInput>) => request<Memory>('PATCH', `/api/memories/${id}`, body),
  deleteMemory: (id: number) => request<{ ok: true }>('DELETE', `/api/memories/${id}`),
  restoreMemory: (id: number) => request<Memory>('POST', `/api/memories/${id}/restore`),
  deletePhoto: (id: number) => request<{ ok: true }>('DELETE', `/api/photos/${id}`),
  restorePhoto: (id: number) => request<{ ok: true }>('POST', `/api/photos/${id}/restore`),
  trash: () => request<{ memories: Memory[]; photos: TrashPhoto[]; comments: TrashComment[] }>('GET', '/api/trash'),

  addComment: (memoryId: number, text: string) => request<Comment>('POST', `/api/memories/${memoryId}/comments`, { text }),
  deleteComment: (id: number) => request<{ ok: true }>('DELETE', `/api/comments/${id}`),
  restoreComment: (id: number) => request<Comment>('POST', `/api/comments/${id}/restore`),
  addSticker: (memoryId: number, body: { key: StickerKey; x?: number; y?: number }) =>
    request<StickerPlacement>('POST', `/api/memories/${memoryId}/stickers`, body),
  deleteSticker: (id: number) => request<{ ok: true }>('DELETE', `/api/stickers/${id}`),

  keyDates: () => request<{ keyDates: KeyDate[] }>('GET', '/api/key-dates'),
  createKeyDate: (body: { label: string; date: string }) => request<KeyDate>('POST', '/api/key-dates', body),
  deleteKeyDate: (id: number) => request<{ ok: true }>('DELETE', `/api/key-dates/${id}`),
  bubbles: (date: string) => request<BubbleSources>('GET', `/api/bubbles?date=${date}`),

  places: () => request<{ places: Place[] }>('GET', '/api/places'),
  place: (id: number) => request<Place>('GET', `/api/places/${id}`),
  placeMemories: (id: number) => request<{ place: Place; memories: Memory[] }>('GET', `/api/places/${id}/memories`),
  createPlace: (body: PlaceInput) => request<Place>('POST', '/api/places', body),
  updatePlace: (id: number, body: Partial<PlaceInput>) => request<Place>('PATCH', `/api/places/${id}`, body),
  deletePlace: (id: number) => request<{ ok: true }>('DELETE', `/api/places/${id}`),
  mergePlace: (id: number, into: number) => request<Place>('POST', `/api/places/${id}/merge`, { into }),
  splitPlace: (id: number, body: { memoryIds: number[]; name: string }) => request<Place>('POST', `/api/places/${id}/split`, body),
}

export function photoUrl(photoId: number, variant: PhotoVariant): string {
  return `/files/${photoId}/${variant}`
}

export const EXPORT_URL = '/api/export'

/**
 * Uploads one photo. Uses the browser's `fetch` because the file is a `File`
 * object; a mini program build would replace this function with
 * `Taro.uploadFile`.
 */
export async function uploadPhoto(
  memoryId: number,
  file: File,
  meta: PhotoMetaInput = {},
  sortOrder?: number,
): Promise<Photo> {
  const form = new FormData()
  form.set('file', file, file.name)
  if (meta.takenAt) form.set('takenAt', meta.takenAt)
  if (typeof meta.latitude === 'number' && typeof meta.longitude === 'number') {
    form.set('latitude', String(meta.latitude))
    form.set('longitude', String(meta.longitude))
  }
  if (sortOrder !== undefined) form.set('sortOrder', String(sortOrder))
  let res: Response
  try {
    res = await fetch(`/api/memories/${memoryId}/photos`, { method: 'POST', body: form, credentials: 'same-origin' })
  } catch {
    throw new ApiFailure(0, 'network')
  }
  if (res.ok) return (await res.json()) as Photo
  const body = await res.json().catch(() => null)
  if (res.status === 401) onUnauthorized?.()
  throw new ApiFailure(res.status, body?.error ?? 'generic')
}

/** Runs `worker` over `items` with a fixed number of parallel tasks. */
export async function runPool<T>(items: T[], limit: number, worker: (item: T, index: number) => Promise<void>): Promise<void> {
  let next = 0
  const run = async () => {
    while (next < items.length) {
      const i = next++
      await worker(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run))
}
