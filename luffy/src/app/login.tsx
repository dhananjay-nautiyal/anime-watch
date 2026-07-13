import { useState, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import { useRouter, Link } from 'expo-router'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useColorScheme } from 'react-native'
import { useAuth } from '@anime/auth'
import * as Haptics from 'expo-haptics'
import { Palette, DarkPalette, Typography, Spacing, BorderRadius } from '@/constants/theme'
import PressableScale from '@/components/PressableScale'

function extractAuthError(err: any): string {
  const msg = err?.response?.data?.message
  if (msg) return msg
  const code = err?.response?.data?.errorCode
  if (code === 'INVALID_CREDENTIALS') return 'Invalid email or password.'
  if (code === 'ACCOUNT_LOCKED') return 'Account locked. Try again later.'
  if (code === 'EMAIL_NOT_VERIFIED') return 'Please verify your email first.'
  if (err?.code === 'ECONNABORTED') return 'Connection timed out.'
  if (err?.message?.includes('Network Error')) return 'Network error. Check your connection.'
  if (err?.response?.status === 429) return 'Too many attempts. Please wait.'
  if (err?.response?.status >= 500) return 'Server error. Try again later.'
  return 'Something went wrong. Please try again.'
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const colorScheme = useColorScheme()
  const colors = colorScheme === 'dark' ? DarkPalette : Palette
  const { login } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleLogin = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (!email.trim()) { setError('Email is required'); return }
    if (!password.trim()) { setError('Password is required'); return }
    setError('')
    setSubmitting(true)
    try {
      await login(email.trim(), password.trim())
      router.replace('/(tabs)')
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      setError(extractAuthError(err))
    } finally {
      setSubmitting(false)
    }
  }, [email, password, login, router])

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + Spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
        accessibilityLabel="Login screen"
      >
        <View style={styles.brandSection}>
          <MaterialCommunityIcons name="movie-open-star" size={56} color={colors.primary} />
          <Text style={[styles.brandTitle, { color: colors.onSurface }]}>AnimeWatch</Text>
          <Text style={[styles.brandSubtitle, { color: colors.onSurfaceVariant }]}>Sign in to continue</Text>
        </View>

        {error ? (
          <View style={[styles.errorBox, { backgroundColor: colors.errorContainer }]} accessibilityRole="alert">
            <MaterialCommunityIcons name="alert-circle" size={20} color={colors.error} />
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          </View>
        ) : null}

        <Text style={[styles.fieldLabel, { color: colors.onSurfaceVariant }]}>Email</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surfaceContainerHigh, color: colors.onSurface, borderColor: error ? colors.error : colors.outlineVariant }]}
          placeholder="you@example.com"
          placeholderTextColor={colors.onSurfaceVariant}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          editable={!submitting}
          accessibilityLabel="Email address"
        />

        <Text style={[styles.fieldLabel, { color: colors.onSurfaceVariant }]}>Password</Text>
        <View style={[styles.passwordRow, { backgroundColor: colors.surfaceContainerHigh, borderColor: error ? colors.error : colors.outlineVariant }]}>
          <TextInput
            style={[styles.passwordInput, { color: colors.onSurface }]}
            placeholder="Enter your password"
            placeholderTextColor={colors.onSurfaceVariant}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoComplete="password"
            editable={!submitting}
            accessibilityLabel="Password"
          />
          <PressableScale onPress={() => { Haptics.selectionAsync(); setShowPassword(!showPassword) }} haptics style={styles.eyeButton}>
            <MaterialCommunityIcons name={showPassword ? 'eye-off' : 'eye'} size={22} color={colors.onSurfaceVariant} />
          </PressableScale>
        </View>

        <PressableScale
          onPress={handleLogin}
          haptics
          hapticType="medium"
          disabled={submitting}
          style={[styles.button, { backgroundColor: colors.primary }, submitting && { opacity: 0.6 }]}
        >
          {submitting ? (
            <ActivityIndicator color={colors.onPrimary} size="small" />
          ) : (
            <Text style={[styles.buttonText, { color: colors.onPrimary }]}>Sign In</Text>
          )}
        </PressableScale>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.onSurfaceVariant }]}>Don't have an account? </Text>
          <Link href="/register" asChild>
            <TouchableOpacity accessibilityRole="link" accessibilityLabel="Create an account">
              <Text style={[styles.footerLink, { color: colors.primary }]}>Create one</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  brandSection: { alignItems: 'center', marginBottom: Spacing.xl, gap: Spacing.sm },
  brandTitle: { ...Typography.headlineLarge, fontWeight: '700' },
  brandSubtitle: { ...Typography.bodyLarge },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.md },
  errorText: { ...Typography.bodyMedium, flex: 1 },
  fieldLabel: { ...Typography.labelLarge, marginBottom: Spacing.xs, marginTop: Spacing.sm },
  input: { ...Typography.bodyLarge, borderRadius: BorderRadius.md, borderWidth: 1, paddingHorizontal: Spacing.md, paddingVertical: 14 },
  passwordRow: { flexDirection: 'row', alignItems: 'center', borderRadius: BorderRadius.md, borderWidth: 1 },
  passwordInput: { ...Typography.bodyLarge, flex: 1, paddingHorizontal: Spacing.md, paddingVertical: 14 },
  eyeButton: { paddingHorizontal: Spacing.md, paddingVertical: 14 },
  button: { borderRadius: BorderRadius.full, paddingVertical: 16, alignItems: 'center', marginTop: Spacing.lg },
  buttonText: { ...Typography.labelLarge, fontSize: 16 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.xl },
  footerText: { ...Typography.bodyMedium },
  footerLink: { ...Typography.labelLarge },
})
