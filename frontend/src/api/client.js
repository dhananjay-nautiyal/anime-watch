import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || ''

const client = axios.create({
  baseURL: API_BASE,
  timeout: 25000,
  headers: { 'Content-Type': 'application/json' },
})

client.interceptors.request.use((config) => {
  if (import.meta.env.DEV) {
    console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`)
  }
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let isRefreshing = false
let refreshSubscribers = []

const onRefreshed = (token) => {
  refreshSubscribers.forEach((cb) => cb(token))
  refreshSubscribers = []
}

client.interceptors.response.use(
  (res) => {
    if (import.meta.env.DEV) {
      console.log(`[API] ${res.status} ${res.config.method?.toUpperCase()} ${res.config.url}`)
    }
    return res
  },
  async (err) => {
    const original = err.config

    if (err.response?.status === 401 && !original._retry) {
      original._retry = true
      const rt = localStorage.getItem('refreshToken')
      if (rt) {
        if (!isRefreshing) {
          isRefreshing = true
          try {
            const { data } = await axios.post(`${API_BASE}/api/auth/refresh`, { refreshToken: rt })
            localStorage.setItem('token', data.token)
            isRefreshing = false
            onRefreshed(data.token)
            original.headers.Authorization = `Bearer ${data.token}`
            return client(original)
          } catch {
            isRefreshing = false
            refreshSubscribers = []
            localStorage.removeItem('token')
            localStorage.removeItem('refreshToken')
            window.location.href = '/login'
            return Promise.reject(err)
          }
        }
        return new Promise((resolve) => {
          refreshSubscribers.push((token) => {
            original.headers.Authorization = `Bearer ${token}`
            resolve(client(original))
          })
        })
      }
    }

    return Promise.reject(err)
  }
)

export function extractErrorMessage(err) {
  if (err.response?.data?.message) {
    return err.response.data.message
  }
  if (err.code === 'ECONNABORTED') {
    return 'Request timed out. The server may be busy.'
  }
  if (err.message?.includes('Network Error')) {
    return 'Network error. Check your connection.'
  }
  return 'Something went wrong. Please try again.'
}

export default client
