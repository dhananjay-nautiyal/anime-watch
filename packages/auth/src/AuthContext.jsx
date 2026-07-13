import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { configureTokenStorage } from '@anime/api'

const AuthContext = createContext(null)

export function AuthProvider({ children, storage, apiClient }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    configureTokenStorage(storage)
  }, [storage])

  useEffect(() => {
    let cancelled = false

    async function init() {
      const token = await storage.getToken()
      if (!token) {
        setLoading(false)
        return
      }
      try {
        const res = await apiClient.get('/api/user/me')
        if (!cancelled) {
          setUser(res.data?.data ?? res.data)
        }
      } catch {
        if (!cancelled) setUser(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    init()
    return () => { cancelled = true }
  }, [storage, apiClient])

  const login = useCallback(async (email, password) => {
    const res = await apiClient.post('/api/auth/login', { email, password })
    const body = res.data?.data ?? res.data
    const token = body.token ?? body.accessToken
    const refreshTokenVal = body.refreshToken
    const userData = body.user ?? body

    await storage.setToken(token)
    if (refreshTokenVal) {
      await storage.setRefreshToken(refreshTokenVal)
    }
    setUser(userData)
    return userData
  }, [storage, apiClient])

  const register = useCallback(async (name, email, password) => {
    const res = await apiClient.post('/api/auth/register', { name, email, password })
    const body = res.data?.data ?? res.data
    const token = body.token ?? body.accessToken
    const refreshTokenVal = body.refreshToken
    const userData = body.user ?? body

    if (token) {
      await storage.setToken(token)
      if (refreshTokenVal) {
        await storage.setRefreshToken(refreshTokenVal)
      }
      setUser(userData)
    }
    return userData
  }, [storage, apiClient])

  const logout = useCallback(async () => {
    try {
      const rt = await storage.getRefreshToken()
      if (rt) {
        apiClient.post('/api/auth/logout', { refreshToken: rt }).catch(() => {})
      }
    } catch {}
    await storage.clearTokens()
    setUser(null)
  }, [storage, apiClient])

  const value = useMemo(() => ({
    user,
    isAuthenticated: !!user,
    loading,
    login,
    register,
    logout,
  }), [user, loading, login, register, logout])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
