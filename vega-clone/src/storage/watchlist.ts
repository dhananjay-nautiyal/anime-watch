import * as SecureStore from 'expo-secure-store'

const KEY = 'vega.watchlist.v1'

export interface WatchItem {
  id: number
  type: 'movie' | 'tv'
  title: string
  poster_path?: string | null
  backdrop_path?: string | null
  addedAt: number
}

export async function loadWatchlist(): Promise<WatchItem[]> {
  try {
    const raw = await SecureStore.getItemAsync(KEY)
    if (!raw) return []
    return JSON.parse(raw) as WatchItem[]
  } catch {
    return []
  }
}

export async function saveWatchlist(items: WatchItem[]): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(items))
}

export function isInWatchlist(items: WatchItem[], id: number, type: 'movie' | 'tv') {
  return items.some(i => i.id === id && i.type === type)
}