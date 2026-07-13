import { memo, useEffect, useState } from 'react'
import { View, Text, StyleSheet, Animated } from 'react-native'
import { useColorScheme } from 'react-native'
import { Palette, DarkPalette, Typography, Spacing } from '@/constants/theme'
import { MaterialCommunityIcons } from '@expo/vector-icons'

function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false)
  const slideAnim = useState(new Animated.Value(-50))[0]
  const colorScheme = useColorScheme()
  const colors = colorScheme === 'dark' ? DarkPalette : Palette

  useEffect(() => {
    // Uses NetInfo-like approach via event listeners
    // In production, use @react-native-community/netinfo
    const onlineHandler = () => setIsOffline(false)
    const offlineHandler = () => setIsOffline(true)

    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('online', onlineHandler)
      window.addEventListener('offline', offlineHandler)
      setIsOffline(!navigator.onLine)
    }

    return () => {
      if (typeof window !== 'undefined' && window.removeEventListener) {
        window.removeEventListener('online', onlineHandler)
        window.removeEventListener('offline', offlineHandler)
      }
    }
  }, [])

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: isOffline ? 0 : -50,
      friction: 8,
      tension: 100,
      useNativeDriver: true,
    }).start()
  }, [isOffline, slideAnim])

  if (!isOffline && (slideAnim as any)._value <= -50) return null

  return (
    <Animated.View
      style={[
        styles.banner,
        { backgroundColor: colors.error, transform: [{ translateY: slideAnim }] },
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
    >
      <MaterialCommunityIcons name="wifi-off" size={16} color="#FFF" />
      <Text style={styles.text}>You are offline. Some features may be unavailable.</Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  text: {
    ...Typography.labelMedium,
    color: '#FFF',
    fontWeight: '600',
  },
})

export default memo(OfflineBanner)
