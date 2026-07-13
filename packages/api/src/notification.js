import client from './client'

export function registerPushToken(expoPushToken, platform) {
  return client.post('/api/notifications/register', { expoPushToken, platform })
}

export function unregisterPushToken(expoPushToken) {
  return client.delete('/api/notifications/unregister', { params: { expoPushToken } })
}

export function getNotificationPreferences() {
  return client.get('/api/notifications/preferences')
}

export function updateNotificationPreferences(preferences) {
  return client.put('/api/notifications/preferences', { preferences })
}

export function sendTestNotification() {
  return client.post('/api/notifications/send-test')
}
