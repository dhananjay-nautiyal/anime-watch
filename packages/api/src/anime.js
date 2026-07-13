import client, { extractErrorMessage, extractErrorCode } from './client'

const unwrapData = res => res.data?.data ?? res.data ?? []

const unwrapPaged = res => ({
  data: res.data?.data ?? [],
  page: res.data?.page ?? 0,
  totalPages: res.data?.totalPages ?? 1,
})

export const createStreamToken = (embedUrl, signal) =>
  client.post('/api/stream/token', { url: embedUrl }, { timeout: 5000, signal }).then(res => res.data?.data ?? null)

export const getTrending = (page = 0, size = 25, signal) =>
  client.get('/api/anime/trending', { params: { page, size }, signal }).then(unwrapPaged)

export const searchAnime = (q, page = 0, size = 25, signal) =>
  client.get('/api/anime/search', { params: { q, page, size }, signal }).then(unwrapPaged)

export const filterAnime = (params, signal) =>
  client.get('/api/anime/filter', { params, signal }).then(unwrapPaged)

export const getAnimeById = (id, signal) =>
  client.get(`/api/anime/${id}`, { signal }).then(res => res.data?.data ?? null)

export const getAnimeBySlug = (slug, signal) =>
  client.get(`/api/anime/slug/${slug}`, { signal }).then(res => res.data?.data ?? null)

export const getSeasonal = (page = 0, size = 25, signal) =>
  client.get('/api/anime/seasonal', { params: { page, size }, signal }).then(unwrapPaged)

export const addReview = (animeId, starRating, comment) =>
  client.post(`/api/anime/${animeId}/review`, { starRating, comment }).then(res => res.data?.data ?? null)

export const getReviews = (animeId, page = 0, size = 10, signal) =>
  client.get(`/api/anime/${animeId}/reviews`, { params: { page, size }, signal }).then(res => ({
    content: res.data?.data?.content ?? [],
    totalPages: res.data?.data?.totalPages ?? 1,
    number: res.data?.data?.number ?? page,
  }))

export const getEpisodes = (malId, signal) =>
  client.get(`/api/anime/${malId}/episodes`, { signal }).then(unwrapData)

export const syncEpisodes = (malId) => {
  return client.post(`/api/anime/${malId}/episodes/sync`, null, { timeout: 60000 }).then(res => {
    const body = res.data
    if (!body?.success) {
      const err = new Error(body?.message || 'Sync failed')
      err.errorCode = body?.errorCode || extractErrorCode({ response: { data: body } })
      err.data = body?.data
      throw err
    }
    return body.data ?? []
  }).catch(err => {
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
  client.get(`/api/anime/${malId}/episode/embed`, { params: { episodeUrl }, timeout: 20000, signal }).then(res => {
    const payload = res.data?.data
    if (!payload) return null
    return payload
  })

export const getEpisodePlayData = (malId, episodeUrl, signal) =>
  client.get(`/api/anime/${malId}/episode/play`, { params: { episodeUrl }, timeout: 60000, signal }).then(res => {
    return res.data?.data ?? null
  })

export const getEpisodeLanguages = (malId, episodeUrl, signal) =>
  client.get(`/api/anime/${malId}/episode/languages`, { params: { episodeUrl }, timeout: 30000, signal }).then(res => {
    const payload = res.data?.data
    if (!payload?.languages) return []
    return payload.languages
  })

export const getEpisodeStreams = (malId, episodeUrl, language, signal) => {
  const params = { episodeUrl }
  if (language) params.language = language
  return client.get(`/api/anime/${malId}/episode/streams`, { params, timeout: 60000, signal }).then(res => {
    const payload = res.data?.data
    if (!payload) return null
    return payload
  })
}

export const getAnimeState = (id, signal) =>
  client.get(`/api/anime/${id}/state`, { signal }).then(res => res.data?.data ?? null)

export const getAnimeStates = (ids, signal) => {
  if (!ids || ids.length === 0) return []
  const idStr = ids.join(',')
  return client.get(`/api/anime/states?ids=${idStr}`, { signal }).then(res => res.data?.data ?? [])
}

export const getHomePage = (signal) =>
  client.get('/api/anime/home', { signal }).then(res => res.data?.data ?? {})

export const getComingSoonAnime = (page = 0, size = 25, signal) =>
  client.get('/api/anime/filter', { params: { status: 'upcoming', page, size }, signal }).then(unwrapPaged)

export const isComingSoon = async (malId) => {
  try {
    const state = await getAnimeState(malId)
    return state?.comingSoon === true
  } catch {
    return false
  }
}
