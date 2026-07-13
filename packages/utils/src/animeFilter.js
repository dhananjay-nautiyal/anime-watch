const PLACEHOLDER_PATTERNS = [
  'placeholder', 'na_', 'no-image', 'missing',
  'default-thumb', 'logo', '4k9oyt', '?s=',
  'questionmark', 'awaiting',
]

const VALID_TYPES = new Set(['TV', 'Movie', 'OVA', 'ONA', 'Special'])
const EXCLUDED_TYPES = new Set(['Music', 'CM', 'PV', 'Promo', 'Commercial', 'Trailer', 'Unknown'])

export function isPlaceholderImage(url) {
  if (!url) return true
  const lower = url.toLowerCase()
  return PLACEHOLDER_PATTERNS.some(p => lower.includes(p))
}

export function isValidAnime(anime) {
  const reasons = []

  if (!anime) {
    reasons.push('Null or undefined anime object')
    return { valid: false, reasons }
  }

  if (!anime.title || !anime.title.trim()) {
    reasons.push('No title')
  }

  if (!anime.malId && !anime.id) {
    reasons.push('No MAL ID')
  }

  const imageUrl = anime.imageUrl || anime.images?.jpg?.image_url
  if (!imageUrl) {
    reasons.push('Poster missing')
  } else if (isPlaceholderImage(imageUrl)) {
    reasons.push('Placeholder poster')
  }

  if (anime.episodes !== null && anime.episodes !== undefined && anime.episodes === 0) {
    reasons.push('Episode count = 0')
  }

  const type = (anime.type || '').trim()
  if (type && EXCLUDED_TYPES.has(type)) {
    reasons.push(`Type = ${type}`)
  }

  return {
    valid: reasons.length === 0,
    reasons,
  }
}

export function filterAndLog(items, source) {
  const valid = []
  const skipped = []

  for (const item of items) {
    const { valid: isValid, reasons } = isValidAnime(item)
    if (isValid) {
      valid.push(item)
    } else {
      skipped.push({ title: item?.title || 'unknown', reasons })
    }
  }

  if (skipped.length > 0) {
    const ratio = `${valid.length}/${items.length}`
    console.log(`[AnimeFilter] ${source} - ${ratio} valid`)
    skipped.forEach(s => {
      console.warn(`Skipped "${s.title}":`, s.reasons)
    })
  }

  return valid
}

export function withFallback(fetchFn, validateFn, targetCount, maxPages = 3) {
  const results = []

  async function fetchPage(page) {
    try {
      const response = await fetchFn(page)
      const items = response.data || []
      const validated = items.filter(validateFn)
      results.push(...validated)
      const hasMore = response.page < response.totalPages - 1
      return { items: validated, hasMore, totalPages: response.totalPages }
    } catch {
      return { items: [], hasMore: false, totalPages: 1 }
    }
  }

  return {
    async fetch() {
      for (let page = 0; page < maxPages; page++) {
        if (results.length >= targetCount) break
        const { hasMore } = await fetchPage(page)
        if (!hasMore) break
      }
      return results.slice(0, targetCount)
    },
  }
}
