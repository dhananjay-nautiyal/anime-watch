import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { DarkPalette, Spacing } from '@/constants/theme'

export default function DownloadsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Downloads</Text>
      <Text style={styles.subtitle}>No downloaded media yet.</Text>
      <Text style={styles.note}>This replica marks a download queue entry point; actual segmented downloads require a source provider.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DarkPalette.background, justifyContent: 'center', padding: Spacing.xl },
  title: { color: DarkPalette.onSurface, fontSize: 24, fontWeight: '700', marginBottom: Spacing.sm },
  subtitle: { color: DarkPalette.onSurfaceVariant, fontSize: 16 },
  note: { color: DarkPalette.onSurfaceVariant, fontSize: 13, marginTop: Spacing.lg, opacity: 0.7 },
})