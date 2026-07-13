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

export default function RegisterScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const colorScheme = useColorScheme()
  const colors = colorScheme === 'dark' ? DarkPalette : Palette
  const { register } = useAuth()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleRegister = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (!name.trim()) { setError('Name is required'); return }
    if (!email.trim()) { setError('Email is required'); return }
    if (!password.trim()) { setError('Password is required'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (password !== confirmPassword) { setError('Passwords do not match'); return }
    setError('')
    setSubmitting(true)
    try {
      await register(name.trim(), email.trim(), password.trim())
      router.replace('/(tabs)')
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      setError(err?.response?.data?.message || 'Registration failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }, [name, email, password, confirmPassword, register, router])

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + Spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
        accessibilityLabel="Register screen"
      >
        <View style={styles.brandSection}>
          <MaterialCommunityIcons name="account-plus" size={48} color={colors.primary} />
          <Text style={[styles.title, { color: colors.onSurface }]}>Create Account</Text>
          <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>Join AnimeWatch today</Text>
        </View>

        {error ? (
          <View style={[styles.errorBox, { backgroundColor: colors.errorContainer }]} accessibilityRole="alert">
            <MaterialCommunityIcons name="alert-circle" size={20} color={colors.error} />
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          </View>
        ) : null}

        <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>Name</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surfaceContainerHigh, color: colors.onSurface, borderColor: error ? colors.error : colors.outlineVariant }]}
          placeholder="Your name"
          placeholderTextColor={colors.onSurfaceVariant}
          value={name}
          onChangeText={setName}
          autoComplete="name"
          editable={!submitting}
          accessibilityLabel="Your name"
        />

        <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>Email</Text>
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

        <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>Password</Text>
        <View style={[styles.passwordRow, { backgroundColor: colors.surfaceContainerHigh, borderColor: error ? colors.error : colors.outlineVariant }]}>
          <TextInput
            style={[styles.passwordInput, { color: colors.onSurface }]}
            placeholder="At least 6 characters"
            placeholderTextColor={colors.onSurfaceVariant}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoComplete="new-password"
            editable={!submitting}
            accessibilityLabel="Password"
          />
          <PressableScale onPress={() => { Haptics.selectionAsync(); setShowPassword(!showPassword) }} haptics style={styles.eyeBtn}>
            <MaterialCommunityIcons name={showPassword ? 'eye-off' : 'eye'} size={22} color={colors.onSurfaceVariant} />
          </PressableScale>
        </View>

        <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>Confirm Password</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surfaceContainerHigh, color: colors.onSurface, borderColor: error ? colors.error : colors.outlineVariant }]}
          placeholder="Repeat your password"
          placeholderTextColor={colors.onSurfaceVariant}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoComplete="new-password"
          editable={!submitting}
          accessibilityLabel="Confirm password"
        />

        <PressableScale
          onPress={handleRegister}
          haptics
          hapticType="medium"
          disabled={submitting}
          style={[styles.button, { backgroundColor: colors.primary }, submitting && { opacity: 0.6 }]}
        >
          {submitting ? (
            <ActivityIndicator color={colors.onPrimary} size="small" />
          ) : (
            <Text style={[styles.buttonText, { color: colors.onPrimary }]}>Create Account</Text>
          )}
        </PressableScale>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.onSurfaceVariant }]}>Already have an account? </Text>
          <Link href="/login" asChild>
            <TouchableOpacity accessibilityRole="link" accessibilityLabel="Sign in instead">
              <Text style={[styles.footerLink, { color: colors.primary }]}>Sign In</Text>
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
  title: { ...Typography.headlineMedium, fontWeight: '700' },
  subtitle: { ...Typography.bodyLarge },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.md },
  errorText: { ...Typography.bodyMedium, flex: 1 },
  label: { ...Typography.labelLarge, marginBottom: Spacing.xs, marginTop: Spacing.sm },
  input: { ...Typography.bodyLarge, borderRadius: BorderRadius.md, borderWidth: 1, paddingHorizontal: Spacing.md, paddingVertical: 14 },
  passwordRow: { flexDirection: 'row', alignItems: 'center', borderRadius: BorderRadius.md, borderWidth: 1 },
  passwordInput: { ...Typography.bodyLarge, flex: 1, paddingHorizontal: Spacing.md, paddingVertical: 14 },
  eyeBtn: { paddingHorizontal: Spacing.md, paddingVertical: 14 },
  button: { borderRadius: BorderRadius.full, paddingVertical: 16, alignItems: 'center', marginTop: Spacing.lg },
  buttonText: { ...Typography.labelLarge, fontSize: 16 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.xl },
  footerText: { ...Typography.bodyMedium },
  footerLink: { ...Typography.labelLarge },
})
