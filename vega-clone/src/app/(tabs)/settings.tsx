import React, { useState } from 'react'
import { View, Text, Pressable, Switch, StyleSheet, ScrollView } from 'react-native'
import { DarkPalette, Spacing, BorderRadius } from '@/constants/theme'

function Row({ label, value, onPress }: { label: string; value?: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
    </Pressable>
  )
}

export default function SettingsScreen() {
  const [haptics, setHaptics] = useState(true)
  const [downloadsTab, setDownloadsTab] = useState(true)
  return (
    <ScrollView style={{ flex: 1, backgroundColor: DarkPalette.background }} contentContainerStyle={{ padding: Spacing.md, paddingTop: 50 }}>
      <Text style={{ color: DarkPalette.onSurface, fontSize: 24, fontWeight: '700', marginBottom: Spacing.md }}>Settings</Text>
      <View style={styles.card}>
        <Row label="Appearance" value="Dark" />
        <Row label="Extensions" value="Manage providers" />
        <Row label="Preferences" value="Quality, downloads" />
        <Row label="Subtitle Preferences" value="Font, size, edge" />
      </View>
      <View style={styles.card}>
        <View style={styles.switchRow}>
          <Text style={styles.rowLabel}>Haptic Feedback</Text>
          <Switch value={haptics} onValueChange={setHaptics} />
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.rowLabel}>Show Downloads Tab</Text>
          <Switch value={downloadsTab} onValueChange={setDownloadsTab} />
        </View>
      </View>
      <View style={styles.card}>
        <Row label="About" value="Vega 5.0.1 (replica)" />
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  card: { backgroundColor: DarkPalette.surfaceContainer, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.md },
  row: { paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: DarkPalette.surfaceContainerHigh },
  rowLabel: { color: DarkPalette.onSurface, fontSize: 16 },
  rowValue: { color: DarkPalette.onSurfaceVariant, fontSize: 13, marginTop: 2 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.sm },
})