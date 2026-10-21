import { getApiBaseURL } from '@anime/api'

/**
 * The backend returns proxy URLs as root-relative paths
 * ("/api/stream/proxy?url=...") because the web client resolves them against
 * its own origin. React Native has no origin, so those URLs have to be
 * prefixed with the API base before the player or the downloader can use them.
 */
export function absoluteApiUrl(url?: string | null): string | null {
  if (!url) return null
  const value = url.trim()
  if (!value) return null
  if (/^https?:\/\//i.test(value)) return value
  const base = (getApiBaseURL() || '').replace(/\/$/, '')
  if (!base) return value
  return `${base}${value.startsWith('/') ? '' : '/'}${value}`
}
