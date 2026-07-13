import { useEffect, useRef } from 'react'
import { Stack, useRouter } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from '@anime/auth'
import { client } from '@anime/api'
import { secureStorage } from '@/storage/secureStorage'
import { setupNotificationListeners, syncPushTokenWithBackend } from '@/services/notifications'
import { preventAutoHideAsync } from 'expo-splash-screen'
import OfflineBanner from '@/components/OfflineBanner'
import { setUser, clearUser, addBreadcrumb } from './sentry'

preventAutoHideAsync()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      retry: 2,
    },
  },
})

function NotificationInit() {
  const router = useRouter()
  const { isAuthenticated, user } = useAuth()
  const initialized = useRef(false)

  useEffect(() => {
    addBreadcrumb({ message: 'App mounted', category: 'app.lifecycle' })
    if (isAuthenticated && user?.id) {
      setUser(String(user.id), user.email)
    } else {
      clearUser()
    }
  }, [isAuthenticated, user])

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    setupNotificationListeners(
      undefined,
      response => {
        const data = response.notification.request.content.data as Record<string, string> | undefined
        if (!data) return

        if (data.animeSlug) {
          router.push(`/anime/${data.animeSlug}`)
        } else if (data.url) {
          router.push(data.url)
        }
      },
    )
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      syncPushTokenWithBackend()
    }
  }, [isAuthenticated])

  return null
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider storage={secureStorage} apiClient={client}>
        <NotificationInit />
        <OfflineBanner />
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
            animationDuration: 200,
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="anime/[slug]" />
          <Stack.Screen name="anime/[slug]/ep/[episode]" />
          <Stack.Screen name="continue-watching" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="downloads" />
          <Stack.Screen name="notifications" />
        </Stack>
      </AuthProvider>
    </QueryClientProvider>
  )
}
