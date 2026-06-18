import client from './client'

export const getRoles = () =>
  client.get('/api/codes/roles')

export const getWatchlistStatuses = () =>
  client.get('/api/codes/watchlist-statuses')
