import { memo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useColorScheme } from 'react-native'
import { Palette, DarkPalette, Typography, Spacing, BorderRadius } from '@/constants/theme'
import PressableScale from './PressableScale'

interface Props {
  message?: string
  onRetry?: () => void
}

function ErrorView({ message = 'Something went wrong', onRetry }: Props) {
  const colorScheme = useColorScheme()
  const colors = colorScheme === 'dark' ? DarkPalette : Palette

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.errorContainer }]}>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color={colors.error} />
        <Text style={[styles.message, { color: colors.error }]}>{message}</Text>
        {onRetry && (
          <PressableScale
            onPress={onRetry}
            haptics
            hapticType="medium"
            style={[styles.retryButton, { backgroundColor: colors.error }]}
          >
            <MaterialCommunityIcons name="refresh" size={18} color={colors.onError} />
            <Text style={[styles.retryText, { color: colors.onError }]}>Try Again</Text>
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
  message: {
    ...Typography.bodyLarge,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  retryText: { ...Typography.labelLarge, fontWeight: '600' },
})

export default memo(ErrorView)
