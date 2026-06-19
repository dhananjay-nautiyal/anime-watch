const cache = new Map()
const defaults = { ttl: 5 * 60 * 1000 }

export function getCached(key) {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiry) {
    cache.delete(key)
    return null
  }
  return entry.data
}

export function setCache(key, data, ttl = defaults.ttl) {
  cache.set(key, { data, expiry: Date.now() + ttl })
}

export function clearCache(key) {
  if (key) cache.delete(key)
  else cache.clear()
}

export async function withCache(key, fetcher, ttl) {
  const cached = getCached(key)
  if (cached) return cached
  const data = await fetcher()
  setCache(key, data, ttl)
  return data
}
