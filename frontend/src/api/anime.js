import client from './client'

export const getTrending = (page = 0, size = 25) =>
  client.get('/api/anime/trending', { params: { page, size } })

export const searchAnime = (q, page = 0, size = 25) =>
  client.get('/api/anime/search', { params: { q, page, size } })

export const filterAnime = (params) =>
  client.get('/api/anime/filter', { params })

export const getAnimeById = (id) =>
  client.get(`/api/anime/${id}`)

export const getSeasonal = (page = 0, size = 25) =>
  client.get('/api/anime/seasonal', { params: { page, size } })

export const addReview = (animeId, starRating, comment) =>
  client.post(`/api/anime/${animeId}/review`, { starRating, comment })

export const getReviews = (animeId, page = 0, size = 10) =>
  client.get(`/api/anime/${animeId}/reviews`, { params: { page, size } })
