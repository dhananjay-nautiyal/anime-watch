const API_BASE = import.meta.env.VITE_API_URL || ''

export function proxyImage(url) {
  if (!url) return ''
  if (url.includes('myanimelist.net') || url.includes('anipixcdn.co')) {
    return `${API_BASE}/api/image-proxy?url=${encodeURIComponent(url)}`
  }
  return url
}
