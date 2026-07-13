const FALLBACK = '/images/placeholder-anime.svg'

export function proxyImage(url) {
  if (!url) return FALLBACK
  return url
}
