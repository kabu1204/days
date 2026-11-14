import { useSyncExternalStore } from 'react'
import Taro from '@tarojs/taro'
import type { Lang } from '@days/shared'
import en, { type TextKey } from './en'
import zh from './zh-CN'

export type { TextKey }

const TABLES: Record<Lang, Record<TextKey, string>> = { 'zh-CN': zh, en }
const STORAGE_KEY = 'days.lang'

function initialLang(): Lang {
  try {
    const saved = Taro.getStorageSync(STORAGE_KEY)
    if (saved === 'zh-CN' || saved === 'en') return saved
  } catch {
    /* storage may be unavailable */
  }
  return 'zh-CN'
}

let current: Lang = initialLang()
const listeners = new Set<() => void>()

export function getLang(): Lang {
  return current
}

export function setLang(lang: Lang): void {
  if (lang === current) return
  current = lang
  try {
    Taro.setStorageSync(STORAGE_KEY, lang)
  } catch {
    /* the choice still applies for this visit */
  }
  listeners.forEach((fn) => fn())
}

export type Translate = (key: TextKey, vars?: Record<string, string | number>) => string

export function translate(lang: Lang, key: TextKey, vars?: Record<string, string | number>): string {
  let text = TABLES[lang][key] ?? en[key] ?? key
  if (vars) for (const [k, v] of Object.entries(vars)) text = text.split(`{${k}}`).join(String(v))
  return text
}

/** Returns the translation function and re-renders when the language changes. */
export function useT(): Translate {
  const lang = useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    () => current,
  )
  return (key, vars) => translate(lang, key, vars)
}

/** Maps a server error code to a message, with a general fallback. */
export function errorText(t: Translate, code: string | undefined): string {
  const key = `error.${code}` as TextKey
  return code && key in en ? t(key) : t('error.generic')
}
