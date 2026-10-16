import { useCallback, useEffect, useState } from 'react'
import Constants from 'expo-constants'

const OWNER = 'dhananjay-nautiyal'
const REPO = 'anime-watch'

export interface UpdateInfo {
  version: string
  apkUrl: string
}

function normalizeTag(tag: string): number[] {
  return tag
    .trim()
    .replace(/^v/i, '')
    .split('.')
    .map(n => parseInt(n, 10) || 0)
}

function isNewer(remoteTag: string, localVersion: string): boolean {
  const r = normalizeTag(remoteTag)
  const l = normalizeTag(localVersion)
  for (let i = 0; i < Math.max(r.length, l.length); i++) {
    const a = r[i] || 0
    const b = l[i] || 0
    if (a > b) return true
    if (a < b) return false
  }
  return false
}

export function useAppUpdate() {
  const [update, setUpdate] = useState<UpdateInfo | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)

    async function check() {
      try {
        const localVersion: string =
          Constants.expoConfig?.version ?? Constants.manifest?.version ?? '0.0.0'
        const res = await fetch(
          `https://api.github.com/${OWNER}/${REPO}/releases/latest`,
          { signal: controller.signal, headers: { Accept: 'application/vnd.github+json' } },
        )
        if (!res.ok) return
        const json = await res.json()
        const apk = (json.assets || []).find(
          (a: any) => typeof a?.name === 'string' && a.name.endsWith('.apk') && a.browser_download_url,
        )
        if (!apk || !json.tag_name) return
        if (!cancelled && isNewer(json.tag_name, localVersion)) {
          setUpdate({ version: json.tag_name, apkUrl: apk.browser_download_url })
        }
      } catch {
        // Offline, rate-limited, or no releases: stay silent, try next launch.
      } finally {
        clearTimeout(timer)
      }
    }

    check()
    return () => {
      cancelled = true
      clearTimeout(timer)
      controller.abort()
    }
  }, [])

  const dismiss = useCallback(() => setDismissed(true), [])

  return { update: dismissed ? null : update, dismiss }
}
