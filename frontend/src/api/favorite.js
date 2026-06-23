import client from './client'

const unwrap = (res) => res.data?.data ?? res.data ?? []

export const getFavorites = (signal) =>
  client.get('/api/favorites', { signal }).then(unwrap)

export const addFavorite = (animeId) =>
  client.post(`/api/favorites/${animeId}`)

export const removeFavorite = (animeId) =>
  client.delete(`/api/favorites/${animeId}`)
