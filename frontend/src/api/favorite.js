import client from './client'

export const addFavorite = (animeId) =>
  client.post(`/api/favorites/${animeId}`)

export const getFavorites = () =>
  client.get('/api/favorites')

export const removeFavorite = (animeId) =>
  client.delete(`/api/favorites/${animeId}`)
