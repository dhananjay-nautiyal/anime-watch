import client from './client'

export const setAffiliateUrl = (id, affiliateUrl) =>
  client.put(`/api/admin/anime/${id}/affiliate`, { affiliateUrl })

export const adminDeleteAnime = (id) =>
  client.delete(`/api/admin/anime/${id}`)

export const adminDeleteReview = (id) =>
  client.delete(`/api/admin/review/${id}`)

export const getUsers = (signal) =>
  client.get('/api/admin/users', { signal })

export const adminDeleteUser = (id) =>
  client.delete(`/api/admin/users/${id}`)

export const addAnimeByMalId = (malId) =>
  client.post(`/api/admin/anime/import/${malId}`)

export const importTrendingAnime = (page = 0) =>
  client.post('/api/admin/anime/import/trending', null, { params: { page } })

export const importSeasonalAnime = (page = 0) =>
  client.post('/api/admin/anime/import/seasonal', null, { params: { page } })
