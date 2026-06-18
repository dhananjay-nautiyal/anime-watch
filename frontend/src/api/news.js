import client from './client'

export const getNews = (page = 0, size = 10) =>
  client.get('/api/news', { params: { page, size } })

export const getNewsById = (id) =>
  client.get(`/api/news/${id}`)

export const createNews = (title, content, imageUrl) =>
  client.post('/api/news', { title, content, imageUrl })

export const updateNews = (id, title, content, imageUrl) =>
  client.put(`/api/news/${id}`, { title, content, imageUrl })

export const deleteNews = (id) =>
  client.delete(`/api/news/${id}`)
