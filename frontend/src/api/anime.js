import client from './client'

const unwrapData = (res) => res.data?.data ?? res.data ?? []

export const createStreamToken = (embedUrl) =>
  client.post('/api/stream/token', { url: embedUrl }, { timeout: 5000 }).then((res) => res.data?.data ?? null)

const unwrapPaged = (res) => ({
  data: res.data?.data ?? [],
  page: res.data?.page ?? 0,
  totalPages: res.data?.totalPages ?? 1,
})

export const getTrending = (page = 0, size = 25) =>
  client.get('/api/anime/trending', { params: { page, size } }).then(unwrapPaged)

export const searchAnime = (q, page = 0, size = 25) =>
  client.get('/api/anime/search', { params: { q, page, size } }).then(unwrapPaged)

export const filterAnime = (params) =>
  client.get('/api/anime/filter', { params }).then(unwrapPaged)

export const getAnimeById = (id) =>
  client.get(`/api/anime/${id}`).then((res) => res.data?.data ?? null)

export const getSeasonal = (page = 0, size = 25) =>
  client.get('/api/anime/seasonal', { params: { page, size } }).then(unwrapPaged)

export const addReview = (animeId, starRating, comment) =>
  client.post(`/api/anime/${animeId}/review`, { starRating, comment }).then((res) => res.data?.data ?? null)

export const getReviews = (animeId, page = 0, size = 10) =>
  client.get(`/api/anime/${animeId}/reviews`, { params: { page, size } }).then((res) => ({
    content: res.data?.data?.content ?? [],
    totalPages: res.data?.data?.totalPages ?? 1,
    number: res.data?.data?.number ?? page,
  }))

export const getEpisodes = (malId) =>
  client.get(`/api/anime/${malId}/episodes`).then(unwrapData)

export const syncEpisodes = (malId) =>
  client.post(`/api/anime/${malId}/episodes/sync`, null, { timeout: 3000 }).then((res) => res.data?.data ?? [])

export const getEpisodeEmbed = (malId, episodeUrl) =>
  client.get(`/api/anime/${malId}/episode/embed`, { params: { episodeUrl }, timeout: 500 }).then((res) => res.data?.data ?? null)
