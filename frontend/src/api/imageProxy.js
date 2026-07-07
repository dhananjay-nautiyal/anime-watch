const API_BASE = import.meta.env.VITE_API_URL || ''

export function proxyImage(url) {
  if (!url) return ''
  if (url.includes('myanimelist.net') || url.includes('anipixcdn.co')) {
    return `https://images.weserv.nl?url=${encodeURIComponent(url)}&w=360&output=webp&q=80`
  }
  return url
}
