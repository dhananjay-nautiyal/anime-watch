import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import { loadWatchlist, saveWatchlist, type WatchItem } from './watchlist'

export interface WatchlistContextValue {
  items: WatchItem[]
  loading: boolean
  add: (item: Omit<WatchItem, 'addedAt'>) => Promise<void>
  remove: (id: number, type: 'movie' | 'tv') => Promise<void>
  contains: (id: number, type: 'movie' | 'tv') => boolean
}

export const WatchlistContext = createContext<WatchlistContextValue>({
  items: [],
  loading: false,
  add: async () => {},
  remove: async () => {},
  contains: () => false,
})

export function WatchlistProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<WatchItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadWatchlist().then((loaded) => {
      setItems(loaded)
      setLoading(false)
    })
  }, [])

  const add = useCallback(async (item: Omit<WatchItem, 'addedAt'>) => {
    setItems((prev) => {
      if (prev.some((i) => i.id === item.id && i.type === item.type)) return prev
      const next = [{ ...item, addedAt: Date.now() }, ...prev]
      saveWatchlist(next).catch(() => {})
      return next
    })
  }, [])

  const remove = useCallback(async (id: number, type: 'movie' | 'tv') => {
    setItems((prev) => {
      const next = prev.filter((i) => !(i.id === id && i.type === type))
      saveWatchlist(next).catch(() => {})
      return next
    })
  }, [])

  const contains = useCallback((id: number, type: 'movie' | 'tv') => {
    return items.some((i) => i.id === id && i.type === type)
  }, [items])

  const value = useMemo(() => ({ items, loading, add, remove, contains }), [items, loading, add, remove, contains])

  return <WatchlistContext.Provider value={value}>{children}</WatchlistContext.Provider>
}

export function useWatchlist() {
  return React.useContext(WatchlistContext)
}