import { memo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useColorScheme } from 'react-native'
import { Palette, DarkPalette, Typography, Spacing, BorderRadius } from '@/constants/theme'
import PressableScale from './PressableScale'

interface Props {
  icon?: keyof typeof MaterialCommunityIcons.glyphMap
  title: string
  subtitle?: string
  actionLabel?: string
  onAction?: () => void
}

function EmptyState({ icon = 'package-variant-closed', title, subtitle, actionLabel, onAction }: Props) {
  const colorScheme = useColorScheme()
  const colors = colorScheme === 'dark' ? DarkPalette : Palette

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.surfaceContainerHigh }]}>
        <View style={[styles.iconCircle, { backgroundColor: colors.surfaceContainerHighest }]}>
          <MaterialCommunityIcons name={icon} size={40} color={colors.onSurfaceVariant} />
        </View>
        <Text style={[styles.title, { color: colors.onSurface }]}>{title}</Text>
        {subtitle && (
          <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>{subtitle}</Text>
        )}
        {actionLabel && onAction && (
          <PressableScale
            onPress={onAction}
            haptics
            style={[styles.button, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.buttonText, { color: colors.onPrimary }]}>{actionLabel}</Text>
          </PressableScale>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  card: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  title: {
    ...Typography.titleMedium,
    fontWeight: '600',
    textAlign: 'center',
  },
  subtitle: {
    ...Typography.bodyMedium,
    textAlign: 'center',
    lineHeight: 20,
  },
  button: {
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
  },
  buttonText: { ...Typography.labelLarge, fontWeight: '600' },
})

export default memo(EmptyState)
