import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { getProfile } from '../api/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const isAuthenticated = !!user

  const fetchUser = useCallback(async (signal) => {
    const token = localStorage.getItem('token')
    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      const res = await getProfile(signal)
      if (signal?.aborted) return
      setUser(res.data?.data ?? res.data)
    } catch {
      localStorage.removeItem('token')
      localStorage.removeItem('refreshToken')
      setUser(null)
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    fetchUser(controller.signal)
    return () => controller.abort()
  }, [fetchUser])

  const login = (token, refreshToken, userData) => {
    localStorage.setItem('token', token)
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken)
    setUser(userData)
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    setUser(null)
  }

  const value = useMemo(() => ({ user, isAuthenticated, loading, login, logout, fetchUser }), [user, loading, login, logout, fetchUser])

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
