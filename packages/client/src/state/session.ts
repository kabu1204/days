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

/** The month shown on the timeline; kept so that returning to it restores the view. */
export const timelineView: { month: string | null } = { month: null }
