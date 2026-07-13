import { useEffect } from 'react'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { Redirect } from 'expo-router'
import { useAuth } from '@anime/auth'
import { hideAsync } from 'expo-splash-screen'

export default function SplashGate() {
  const { isAuthenticated, loading } = useAuth()

  useEffect(() => {
    if (!loading) {
      hideAsync()
    }
  }, [loading])

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#6750A4" />
      </View>
    )
  }

  if (!isAuthenticated) {
    return <Redirect href="/login" />
  }

  return <Redirect href="/(tabs)" />
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1C1B1F',
  },
})
