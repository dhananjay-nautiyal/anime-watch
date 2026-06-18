import client from './client'

export const updateReview = (id, starRating, comment) =>
  client.put(`/api/reviews/${id}`, { starRating, comment })

export const deleteReview = (id) =>
  client.delete(`/api/reviews/${id}`)
