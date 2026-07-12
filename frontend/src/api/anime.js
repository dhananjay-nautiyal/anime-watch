import client, { extractErrorMessage, extractErrorCode } from './client'
import { withCache } from './cache'

const unwrapData = (res) => res.data?.data ?? res.data ?? []

export const createStreamToken = (embedUrl, signal) =>
  client.post('/api/stream/token', { url: embedUrl }, { timeout: 5000, signal }).then((res) => res.data?.data ?? null)

const unwrapPaged = (res) => ({
  data: res.data?.data ?? [],
  page: res.data?.page ?? 0,
  totalPages: res.data?.totalPages ?? 1,
})

export const getTrending = (page = 0, size = 25, signal) =>
  withCache(`trending:${page}:${size}`, () =>
    client.get('/api/anime/trending', { params: { page, size }, signal }).then(unwrapPaged), 60000)

export const searchAnime = (q, page = 0, size = 25, signal) =>
  withCache(`search:${q}:${page}:${size}`, () =>
    client.get('/api/anime/search', { params: { q, page, size }, signal }).then(unwrapPaged), 60000)

export const filterAnime = (params, signal) =>
  withCache(`filter:${JSON.stringify(params)}`, () =>
    client.get('/api/anime/filter', { params, signal }).then(unwrapPaged), 60000)

export const getAnimeById = (id, signal) =>
  withCache(`anime:${id}`, () =>
    client.get(`/api/anime/${id}`, { signal }).then((res) => res.data?.data ?? null), 120000)

export const getAnimeBySlug = (slug, signal) =>
  withCache(`animeSlug:${slug}`, () =>
    client.get(`/api/anime/slug/${slug}`, { signal }).then((res) => res.data?.data ?? null), 120000)

export const getSeasonal = (page = 0, size = 25, signal) =>
  withCache(`seasonal:${page}:${size}`, () =>
    client.get('/api/anime/seasonal', { params: { page, size }, signal }).then(unwrapPaged), 60000)

export const addReview = (animeId, starRating, comment) =>
  client.post(`/api/anime/${animeId}/review`, { starRating, comment }).then((res) => res.data?.data ?? null)

export const getReviews = (animeId, page = 0, size = 10, signal) =>
  withCache(`reviews:${animeId}:${page}:${size}`, () =>
    client.get(`/api/anime/${animeId}/reviews`, { params: { page, size }, signal }).then((res) => ({
      content: res.data?.data?.content ?? [],
      totalPages: res.data?.data?.totalPages ?? 1,
      number: res.data?.data?.number ?? page,
    })), 60000)

export const getEpisodes = (malId, signal) =>
  withCache(`episodes:${malId}`, () =>
    client.get(`/api/anime/${malId}/episodes`, { signal }).then(unwrapData), 120000)

export const syncEpisodes = (malId) => {
  console.log('[Sync] Request body: null (malId in URL path: ' + malId + ')')
  return client.post(`/api/anime/${malId}/episodes/sync`, null, { timeout: 60000 }).then((res) => {
    console.log('[Sync] Response:', res.data)
    const body = res.data
    if (!body?.success) {
      const err = new Error(body?.message || 'Sync failed')
      err.errorCode = body?.errorCode || extractErrorCode({ response: { data: body } })
      err.data = body?.data
      throw err
    }
    return body.data ?? []
  }).catch((err) => {
    if (err.errorCode || err.response?.data?.message) {
      const enhanced = err.errorCode ? err : (() => {
        const e = new Error(extractErrorMessage(err))
        e.errorCode = extractErrorCode(err)
        e.data = err.response?.data?.data
        return e
      })()
      throw enhanced
    }
    throw err
  })
}

export const getStreamableBatch = async (malIds) => {
  if (!malIds || malIds.length === 0) return []
  try {
    const ids = malIds.join(',')
    const res = await client.get(`/api/anime/streamable?ids=${ids}`, { timeout: 10000 })
    const items = res.data?.data ?? []
    return items.filter(i => i.streamable).map(i => i.malId)
  } catch {
    return []
  }
}

export const getEpisodeEmbed = (malId, episodeUrl, signal) =>
  client.get(`/api/anime/${malId}/episode/embed`, { params: { episodeUrl }, timeout: 20000, signal }).then((res) => {
    const payload = res.data?.data
    if (!payload) return null
    return payload
  })

export const getEpisodeLanguages = (malId, episodeUrl, signal) =>
  client.get(`/api/anime/${malId}/episode/languages`, { params: { episodeUrl }, timeout: 15000, signal }).then((res) => {
    const payload = res.data?.data
    if (!payload?.languages) return []
    return payload.languages
  })

export const getEpisodeStreams = (malId, episodeUrl, language, signal) => {
  const params = { episodeUrl }
  if (language) params.language = language
  return client.get(`/api/anime/${malId}/episode/streams`, { params, timeout: 30000, signal }).then((res) => {
    const payload = res.data?.data
    if (!payload) return null
    return payload
  })
}

export const getAnimeState = (id, signal) =>
  withCache(`animeState:${id}`, () =>
    client.get(`/api/anime/${id}/state`, { signal }).then((res) => res.data?.data ?? null), 60000)

export const getAnimeStates = (ids, signal) => {
  if (!ids || ids.length === 0) return []
  const idStr = ids.join(',')
  return client.get(`/api/anime/states?ids=${idStr}`, { signal }).then((res) => res.data?.data ?? [])
}

export const getComingSoonAnime = (page = 0, size = 25, signal) =>
  withCache(`comingSoon:${page}:${size}`, () =>
    client.get('/api/anime/filter', { params: { status: 'upcoming', page, size }, signal }).then(unwrapPaged), 60000)

export const isComingSoon = async (malId) => {
  try {
    const state = await getAnimeState(malId)
    return state?.comingSoon === true
  } catch {
    return false
  }
}


