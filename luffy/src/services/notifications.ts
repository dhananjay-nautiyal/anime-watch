import { Platform } from 'react-native'
import {
  setNotificationHandler,
  getPermissionsAsync,
  requestPermissionsAsync,
  getExpoPushTokenAsync,
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener,
  scheduleNotificationAsync,
  cancelAllScheduledNotificationsAsync,
  getBadgeCountAsync,
  setBadgeCountAsync,
  type Notification,
  type NotificationResponse,
  type NotificationTriggerInput,
} from 'expo-notifications'
import { isDevice } from 'expo-device'
import { registerPushToken, unregisterPushToken } from '@anime/api'
import { insertNotification } from './notificationDB'

setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

export type NotificationType =
  | 'new_episode'
  | 'watch_reminder'
  | 'continue_watching'
  | 'announcement'
  | 'promotion'
  | 'test'
  | 'general'

export interface PushNotificationData {
  type: NotificationType
  animeSlug?: string
  animeId?: string
  episodeNumber?: string
  url?: string
  [key: string]: string | undefined
}

let lastNotificationResponse: NotificationResponse | null = null

export function getLastNotificationResponse() {
  return lastNotificationResponse
}

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!isDevice) {
    return null
  }

  const { status: existingStatus } = await getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== 'granted') {
    const { status } = await requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') {
    return null
  }

  try {
    const tokenData = await getExpoPushTokenAsync({
      projectId: undefined,
    })
    return tokenData.data
  } catch {
    return null
  }
}

export async function setupNotificationListeners(
  onNotificationReceived?: (notification: Notification) => void,
  onNotificationTapped?: (response: NotificationResponse) => void,
): Promise<() => void> {
  const receivedSubscription = addNotificationReceivedListener(
    notification => {
      const data = notification.request.content.data as PushNotificationData | undefined
      if (data?.type) {
        insertNotification(
          data.type,
          notification.request.content.title || '',
          notification.request.content.body || '',
          data as Record<string, string>,
        ).catch(() => {})
      }
      onNotificationReceived?.(notification)
    },
  )

  const tappedSubscription = addNotificationResponseReceivedListener(
    response => {
      lastNotificationResponse = response
      onNotificationTapped?.(response)
    },
  )

  return () => {
    receivedSubscription.remove()
    tappedSubscription.remove()
  }
}

export async function syncPushTokenWithBackend(): Promise<void> {
  try {
    const pushToken = await registerForPushNotificationsAsync()
    if (!pushToken) return

    const platform = Platform.OS === 'ios' ? 'ios' : 'android'
    await registerPushToken(pushToken, platform)
  } catch {
    // Silently fail
  }
}

export async function unregisterPushTokenFromBackend(): Promise<void> {
  try {
    const pushToken = await registerForPushNotificationsAsync()
    if (!pushToken) return
    await unregisterPushToken(pushToken)
  } catch {
    // Silently fail
  }
}

export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: Record<string, string>,
  trigger?: NotificationTriggerInput,
): Promise<string> {
  const id = await scheduleNotificationAsync({
    content: {
      title,
      body,
      data: data ?? {},
      sound: true,
    },
    trigger: trigger ?? { seconds: 1 } as any,
  })
  return id
}

export async function scheduleWatchReminder(
  animeTitle: string,
  animeSlug: string,
  episodeNumber: number,
  delaySeconds: number = 3600,
): Promise<string> {
  return scheduleLocalNotification(
    `Continue Watching: ${animeTitle}`,
    `Episode ${episodeNumber} is waiting for you`,
    {
      type: 'continue_watching',
      animeSlug,
      episodeNumber: String(episodeNumber),
    },
    { seconds: delaySeconds } as any,
  )
}

export async function cancelAllScheduledNotifications(): Promise<void> {
  await cancelAllScheduledNotificationsAsync()
}

export async function getBadgeCount(): Promise<number> {
  return getBadgeCountAsync()
}

export async function setBadgeCount(count: number): Promise<void> {
  await setBadgeCountAsync(count)
}
