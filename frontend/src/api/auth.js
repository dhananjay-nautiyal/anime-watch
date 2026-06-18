import client from './client'

export const login = (email, password) =>
  client.post('/api/auth/login', { email, password })

export const register = (name, email, password) =>
  client.post('/api/auth/register', { name, email, password })

export const logout = (refreshToken) =>
  client.post('/api/auth/logout', { refreshToken })

export const refreshToken = (token) =>
  client.post('/api/auth/refresh', { refreshToken: token })

export const verifyEmail = (token) =>
  client.get('/api/auth/verify', { params: { token } })

export const forgotPassword = (email) =>
  client.post('/api/auth/forgot-password', { email })

export const resetPassword = (token, password) =>
  client.post('/api/auth/reset-password', { token, password })

export const getProfile = () =>
  client.get('/api/user/me')

export const updateProfile = (data) =>
  client.put('/api/user/me', data)
