import type { AppData } from '../types'

const CACHE_KEY = 'hair-app.cache.v1'

export interface CachedData extends AppData {
  userId: string
  savedAt: string
}

/** Keeps the last successful download so the app can open offline, read-only. */
export function saveCache(userId: string, data: AppData): void {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ ...data, userId, savedAt: new Date().toISOString() } satisfies CachedData),
    )
  } catch {
    // Storage full or blocked (private mode) — the app still works online.
  }
}

export function loadCache(userId: string): CachedData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedData
    if (parsed.userId !== userId) return null
    if (!parsed.settings || !Array.isArray(parsed.fittings) || !Array.isArray(parsed.costs)) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

/** Drops the offline copy, so the next account does not inherit it. */
export function clearCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {
    // ignore
  }
}

export function downloadJson(filename: string, payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
