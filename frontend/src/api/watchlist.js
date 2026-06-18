import client from './client'

export const addToWatchlist = (animeId, status) =>
  client.post('/api/watchlist', { animeId, status })

export const updateWatchlistStatus = (id, status) =>
  client.put(`/api/watchlist/${id}`, { status })

export const getWatchlist = () =>
  client.get('/api/watchlist')

export const removeFromWatchlist = (id) =>
  client.delete(`/api/watchlist/${id}`)
