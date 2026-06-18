import client from './client'

export const deleteReview = (id) =>
  client.delete(`/api/reviews/${id}`)
