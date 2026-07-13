import axios from 'axios'

const API_BASE = typeof process !== 'undefined' && (process.env?.EXPO_PUBLIC_API_URL || process.env?.VITE_API_URL)
  ? (process.env.EXPO_PUBLIC_API_URL || process.env.VITE_API_URL)
  : (typeof import.meta !== 'undefined' && (import.meta.env?.EXPO_PUBLIC_API_URL || import.meta.env?.VITE_API_URL)
    ? (import.meta.env.EXPO_PUBLIC_API_URL || import.meta.env.VITE_API_URL)
    : 'https://api.animewatch.app')

const client = axios.create({
  baseURL: API_BASE,
  timeout: 25000,
  headers: { 'Content-Type': 'application/json' },
})

let tokenStore = {
  getToken: () => Promise.resolve(null),
  getRefreshToken: () => Promise.resolve(null),
  setToken: () => Promise.resolve(),
  setRefreshToken: () => Promise.resolve(),
  clearTokens: () => Promise.resolve(),
}

export function configureTokenStorage(store) {
  tokenStore = store
}

let isRefreshing = false
let refreshSubscribers = []

function onRefreshed(token) {
  refreshSubscribers.forEach(cb => cb(token))
  refreshSubscribers = []
}

client.interceptors.request.use(async config => {
  const token = await tokenStore.getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

client.interceptors.response.use(
  res => res,
  async err => {
    const original = err.config

    if (!original) return Promise.reject(err)

    if (err.response?.status === 401 && !original._retry) {
      if (original.url?.includes('/api/auth/')) {
        return Promise.reject(err)
      }

      original._retry = true
      const rt = await tokenStore.getRefreshToken()

      if (rt) {
        if (!isRefreshing) {
          isRefreshing = true
          try {
            const { data } = await axios.post(`${API_BASE}/api/auth/refresh`, { refreshToken: rt })
            await tokenStore.setToken(data.token)
            isRefreshing = false
            onRefreshed(data.token)
            original.headers.Authorization = `Bearer ${data.token}`
            return client(original)
          } catch {
            isRefreshing = false
            refreshSubscribers = []
            await tokenStore.clearTokens()
            return Promise.reject(err)
          }
        }

        return new Promise(resolve => {
          refreshSubscribers.push(token => {
            original.headers.Authorization = `Bearer ${token}`
            resolve(client(original))
          })
        })
      }

      await tokenStore.clearTokens()
    }

    return Promise.reject(err)
  }
)

export function extractErrorMessage(err) {
  if (err.response?.data?.message) return err.response.data.message
  if (err.code === 'ECONNABORTED') return 'Request timed out. The server may be busy.'
  if (err.message?.includes('Network Error')) return 'Network error. Check your connection.'
  if (err.response?.status === 400) return 'The service is temporarily unavailable. Please try again.'
  if (err.response?.status === 429) return 'Too many requests. Please wait a moment and try again.'
  if (err.response?.status >= 500) return 'Server error. Please try again later.'
  return 'Something went wrong. Please try again.'
}

export function extractErrorCode(err) {
  return err.errorCode || err.response?.data?.errorCode || null
}

export default client
