import client from './client'

export const getProfile = () =>
  client.get('/api/user/me')

export const updateProfile = (name) =>
  client.put('/api/user/me', { name })

export const changePassword = (currentPassword, newPassword) =>
  client.put('/api/user/me/password', { currentPassword, newPassword })

export const deleteAccount = () =>
  client.delete('/api/user/me')
