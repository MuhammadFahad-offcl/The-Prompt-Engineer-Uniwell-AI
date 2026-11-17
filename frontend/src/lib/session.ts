// Browser storage holds ONLY the random anonymous ID and a UI cache — never secrets.
const KEY = 'uniwell.anonymous_user_id'
const LANG_KEY = 'uniwell.ui_language'

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* storage unavailable (private mode) — app still works for this tab */
  }
}

let memoryId: string | null = null

export function getUserId(): string | null {
  return safeGet(KEY) ?? memoryId
}

export function getOrCreateUserId(): string {
  const existing = getUserId()
  if (existing) return existing
  const id = 'uw-' + crypto.randomUUID().replace(/-/g, '')
  memoryId = id
  safeSet(KEY, id)
  return id
}

export function clearSession(): void {
  memoryId = null
  try {
    window.localStorage.removeItem(KEY)
    window.localStorage.removeItem(LANG_KEY)
  } catch {
    /* ignore */
  }
}

export function getCachedLanguage(): string | null {
  return safeGet(LANG_KEY)
}

export function cacheLanguage(lang: string): void {
  safeSet(LANG_KEY, lang)
}

export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Karachi'
  } catch {
    return 'Asia/Karachi'
  }
}
