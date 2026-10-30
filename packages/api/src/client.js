import axios from 'axios'

// NOTE: this file must stay free of `import.meta`. Metro/Hermes cannot
// parse that syntax, so a single occurrence crashes every mobile screen
// that imports `@anime/api` at bundle load. Expo inlines
// `process.env.EXPO_PUBLIC_*` at build time, so native reads its URL
// from `process.env` here. Web (Vite) injects its URL via
// `setApiBaseURL()` from `frontend/src/api/client.js`, which *is*
// Vite-processed and may use `import.meta.env`.
function readNativeBaseURL() {
  if (typeof process !== 'undefined' && process.env) {
    const url = (process.env.EXPO_PUBLIC_API_URL || process.env.VITE_API_URL || '').trim()
    if (url) return url.replace(/\/$/, '')
  }
  return ''
}

let API_BASE = readNativeBaseURL()

export function getApiBaseURL() {
  return API_BASE
}

const client = axios.create({
  // Empty string = relative URLs. In web dev that hits the Vite `/api`
  // proxy (localhost:8080); on native a missing EXPO_PUBLIC_API_URL
  // surfaces as a network error instead of silently hitting a placeholder.
  baseURL: API_BASE,
  timeout: 25000,
  headers: { 'Content-Type': 'application/json' },
})

export function setApiBaseURL(url) {
  API_BASE = (url || '').trim().replace(/\/$/, '')
  client.defaults.baseURL = API_BASE
}

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

// Settle every request that queued behind an in-flight refresh. On success
// each subscriber retries with the fresh token; on failure each is rejected so
// no queued request is left hanging forever.
function flushSubscribers(token, error) {
  const pending = refreshSubscribers
  refreshSubscribers = []
  pending.forEach(({ onSuccess, onFailure }) => {
    if (error) {
      onFailure(error)
    } else {
      onSuccess(token)
    }
  })
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
            // The backend revokes the old refresh token and returns a
            // replacement. Persist BOTH: saving only the access token would
            // leave the stored refresh token revoked, so the next refresh
            // fails and the user is silently signed out.
            await tokenStore.setToken(data.token)
            if (data.refreshToken) {
              await tokenStore.setRefreshToken(data.refreshToken)
            }
            isRefreshing = false
            flushSubscribers(data.token)
            original.headers.Authorization = `Bearer ${data.token}`
            return client(original)
          } catch (refreshErr) {
            isRefreshing = false
            // Reject queued requests instead of dropping them, so they fail
            // fast rather than hanging forever.
            flushSubscribers(null, refreshErr)
            await tokenStore.clearTokens()
            return Promise.reject(refreshErr)
          }
        }

        return new Promise((resolve, reject) => {
          refreshSubscribers.push({
            onSuccess: token => {
              original.headers.Authorization = `Bearer ${token}`
              resolve(client(original))
            },
            onFailure: reject,
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
