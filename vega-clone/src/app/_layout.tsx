import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { QueryClientProvider } from '@tanstack/react-query'
import * as SplashScreen from 'expo-splash-screen'
import { WatchlistProvider } from '@/storage/WatchlistProvider'
import { queryClient } from '@/services/tmdb'
import { useFonts } from 'expo-font'
import { MaterialCommunityIcons } from '@expo/vector-icons'

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    ...MaterialCommunityIcons.font,
  })
  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync()
  }, [fontsLoaded])
  if (!fontsLoaded) return null
  return (
    <QueryClientProvider client={queryClient}>
      <WatchlistProvider>
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', animationDuration: 200 }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="details/[id]" />
        </Stack>
      </WatchlistProvider>
    </QueryClientProvider>
  )
}