import client from './client'
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
  return client.post(`/api/anime/${malId}/episodes/sync`, null, { timeout: 3000 }).then((res) => {
    console.log('[Sync] Response:', res.data)
    return res.data?.data ?? []
  })
}

export const getEpisodeEmbed = (malId, episodeUrl, signal) =>
  client.get(`/api/anime/${malId}/episode/embed`, { params: { episodeUrl }, timeout: 20000, signal }).then((res) => {
    const payload = res.data?.data
    if (!payload) return null
    if (typeof payload === 'string') return payload
    return payload?.embedUrl ?? null
  })
