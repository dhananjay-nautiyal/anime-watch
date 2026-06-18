import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || ''

const client = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
})

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

client.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true
      const rt = localStorage.getItem('refreshToken')
      if (rt) {
        try {
          const { data } = await axios.post(`${API_BASE}/api/auth/refresh`, { refreshToken: rt })
          localStorage.setItem('token', data.token)
          original.headers.Authorization = `Bearer ${data.token}`
          return client(original)
        } catch {
          localStorage.removeItem('token')
          localStorage.removeItem('refreshToken')
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(err)
  }
)

export default client
