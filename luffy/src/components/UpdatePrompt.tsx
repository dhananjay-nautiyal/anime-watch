import { memo, useCallback } from 'react'
import { View, Text, Modal, TouchableOpacity, StyleSheet, Linking, Alert } from 'react-native'
import { useColorScheme } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { Palette, DarkPalette, Typography, Spacing, BorderRadius } from '@/constants/theme'
import PressableScale from '@/components/PressableScale'
import type { UpdateInfo } from '@/hooks/useAppUpdate'

interface Props {
  update: UpdateInfo
  onLater: () => void
}

function UpdatePrompt({ update, onLater }: Props) {
  const colorScheme = useColorScheme()
  const colors = colorScheme === 'dark' ? DarkPalette : Palette

  const handleUpdate = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    try {
      await Linking.openURL(update.apkUrl)
    } catch {
      Alert.alert('Update failed', 'Could not open the download. Get it from GitHub Releases instead.')
    }
  }, [update.apkUrl])

  const handleLater = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onLater()
  }, [onLater])

  return (
    <Modal transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.surfaceContainerHigh }]}>
          <MaterialCommunityIcons name="update" size={44} color={colors.primary} />
          <Text style={[styles.title, { color: colors.onSurface }]}>Update available</Text>
          <Text style={[styles.body, { color: colors.onSurfaceVariant }]}>
            Version {update.version} is ready. Update now for the latest fixes and features.
          </Text>
          <PressableScale
            onPress={handleUpdate}
            haptics
            style={[styles.updateBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.updateText, { color: colors.onPrimary }]}>Update</Text>
          </PressableScale>
          <TouchableOpacity onPress={handleLater} style={styles.laterBtn} accessibilityRole="button">
            <Text style={[styles.laterText, { color: colors.onSurfaceVariant }]}>Later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  title: { ...Typography.titleLarge },
  body: { ...Typography.bodyMedium, textAlign: 'center' },
  updateBtn: {
    width: '100%',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  updateText: { ...Typography.labelLarge },
  laterBtn: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg },
  laterText: { ...Typography.labelLarge },
})

export default memo(UpdatePrompt)
