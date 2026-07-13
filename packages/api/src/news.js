import client from './client'

export const getNews = (page = 0, size = 10, signal) =>
  client.get('/api/news', { params: { page, size }, signal }).then(res => ({
    content: res.data?.data?.content ?? [],
    totalPages: res.data?.data?.totalPages ?? 1,
  }))

export const getNewsById = (id, signal) =>
  client.get(`/api/news/${id}`, { signal }).then(res => res.data?.data ?? null)

export const createNews = (title, content, imageUrl) =>
  client.post('/api/news', { title, content, imageUrl })

export const updateNews = (id, title, content, imageUrl) =>
  client.put(`/api/news/${id}`, { title, content, imageUrl })

export const deleteNews = (id) =>
  client.delete(`/api/news/${id}`)
