import client from './client'

export const getNews = (page = 0, size = 10) =>
  client.get('/api/news', { params: { page, size } }).then((res) => ({
    content: res.data?.data?.content ?? [],
    totalPages: res.data?.data?.totalPages ?? 1,
  }))

export const getNewsById = (id) =>
  client.get(`/api/news/${id}`).then((res) => res.data?.data ?? null)
