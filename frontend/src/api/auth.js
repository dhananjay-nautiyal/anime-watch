import client from './client'

export const login = (email, password) =>
  client.post('/api/auth/login', { email, password })

export const register = (name, email, password) =>
  client.post('/api/auth/register', { name, email, password })

export const verifyEmail = (token) =>
  client.get('/api/auth/verify', { params: { token } })

export const resendVerification = (email) =>
  client.post('/api/auth/resend-verification', { email })

export const refreshToken = (refreshToken) =>
  client.post('/api/auth/refresh', { refreshToken })

export const logout = (refreshToken) =>
  client.post('/api/auth/logout', { refreshToken })

export const forgotPassword = (email) =>
  client.post('/api/auth/forgot-password', { email })

export const resetPassword = (token, newPassword) =>
  client.post('/api/auth/reset-password', { token, newPassword })
