import { useEffect, useSyncExternalStore } from 'react'
import Taro from '@tarojs/taro'
import type { Member, StatusResponse } from '@days/shared'
import { api, setUnauthorizedHandler } from '../api/client'
import { setLang } from '../i18n'

export const ROUTES = {
  timeline: '/pages/timeline/index',
  signin: '/pages/signin/index',
  setup: '/pages/setup/index',
  invite: '/pages/invite/index',
  detail: '/pages/memory/detail',
  edit: '/pages/memory/edit',
  settings: '/pages/settings/index',
  trash: '/pages/trash/index',
  importer: '/pages/import/index',
  map: '/pages/map/index',
  places: '/pages/places/index',
  place: '/pages/place/index',
  labExif: '/pages/lab/exif',
  labMap: '/pages/lab/map',
  labPixel: '/pages/lab/pixel',
}

let status: StatusResponse | null = null
let pending: Promise<StatusResponse> | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((fn) => fn())

export function loadStatus(force = false): Promise<StatusResponse> {
  if (status && !force) return Promise.resolve(status)
  if (!pending) {
    pending = api
      .status()
      .then((s) => {
        status = s
        if (s.me) setLang(s.me.lang)
        emit()
        return s
      })
      .finally(() => {
        pending = null
      })
  }
  return pending
}

export function clearStatus(): void {
  status = null
  emit()
}

setUnauthorizedHandler(() => {
  clearStatus()
  Taro.reLaunch({ url: ROUTES.signin })
})

export function useStatus(): StatusResponse | null {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    () => status,
  )
}

/**
 * For pages that require a signed-in member. Sends the visitor to the setup
 * or sign-in page when needed, and returns the member once known.
 */
export function useMember(): Member | null {
  const s = useStatus()
  useEffect(() => {
    // Until the partner has joined, the status is read again on every page,
    // so that the first member sees the partner without signing in again.
    loadStatus(!!status && status.memberCount < 2)
      .then((st) => {
        if (!st.initialized) Taro.reLaunch({ url: ROUTES.setup })
        else if (!st.me) Taro.reLaunch({ url: ROUTES.signin })
      })
      .catch(() => {
        /* the page shows its own loading state; the next action reports the error */
      })
  }, [])
  return s?.me ?? null
}

export function memberName(s: StatusResponse | null, id: number): string {
  return s?.members.find((m) => m.id === id)?.displayName ?? ''
}

/**
 * The month shown on the timeline and the memory selected there; kept so
 * that returning to the timeline, or switching to the map, keeps the view.
 */
export const timelineView: { month: string | null; memoryId: number | null } = { month: null, memoryId: null }

/** The last map position and the Place selected on the map. */
export const mapView: {
  view: { latitude: number; longitude: number; zoom: number } | null
  placeId: number | null
} = { view: null, placeId: null }

/**
 * Shows a memory in its month on the timeline. Returns to the timeline page
 * when it is already open below the current page, so that its state is kept.
 */
export function openTimelineAt(memory: { id: number; startDate: string }): void {
  timelineView.month = memory.startDate.slice(0, 7)
  timelineView.memoryId = memory.id
  const pages = Taro.getCurrentPages()
  const index = pages.findIndex((p) => (p.route ?? '').includes('pages/timeline/index'))
  if (index >= 0 && index < pages.length - 1) Taro.navigateBack({ delta: pages.length - 1 - index })
  else Taro.reLaunch({ url: ROUTES.timeline })
}

/** Opens the map with a memory's Place selected. */
export function openMapAt(placeId: number, memoryId?: number): void {
  mapView.placeId = placeId
  if (memoryId !== undefined) timelineView.memoryId = memoryId
  Taro.navigateTo({ url: `${ROUTES.map}?place=${placeId}${memoryId !== undefined ? `&memory=${memoryId}` : ''}` })
}

const LOWRES_KEY = 'days.map.lowres'

/** Whether the map is drawn at reduced resolution (pixel look). On unless switched off on this device. */
export function getMapLowRes(): boolean {
  try {
    return Taro.getStorageSync(LOWRES_KEY) !== 'off'
  } catch {
    return true
  }
}

export function setMapLowRes(on: boolean): void {
  try {
    Taro.setStorageSync(LOWRES_KEY, on ? 'on' : 'off')
  } catch {
    /* applies for this visit only */
  }
}
