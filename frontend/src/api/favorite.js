import client from './client'

const unwrap = (res) => res.data?.data ?? res.data ?? []

export const getFavorites = () =>
  client.get('/api/favorites').then(unwrap)

export const addFavorite = (animeId) =>
  client.post(`/api/favorites/${animeId}`)

export const removeFavorite = (animeId) =>
  client.delete(`/api/favorites/${animeId}`)
