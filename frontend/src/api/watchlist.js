import client from './client'

const unwrap = (res) => res.data?.data ?? res.data ?? []

export const getWatchlist = (signal) =>
  client.get('/api/watchlist', { signal }).then(unwrap)

export const addToWatchlist = (animeId, status) =>
  client.post('/api/watchlist', { animeId, status }).then((res) => res.data?.data ?? res.data)

export const updateWatchlistStatus = (id, status) =>
  client.put(`/api/watchlist/${id}`, { status })

export const removeFromWatchlist = (id) =>
  client.delete(`/api/watchlist/${id}`)
