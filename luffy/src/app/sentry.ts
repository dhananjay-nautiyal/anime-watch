// Crash reporting is currently disabled (no DSN configured).
// This module keeps the same export surface so call sites don't change;
// plug a real provider (e.g. @sentry/react-native) back in when ready.
// Previously this wrapped `sentry-expo`, whose missing native peer
// (@sentry/react-native was never installed) crashed the app ~1s after
// launch in release builds.

type Breadcrumb = { message: string; category?: string }

export const captureException = (_error: unknown, _context?: Record<string, unknown>): void => {}

export const captureMessage = (_message: string): void => {}

export const setUser = (_userId: string, _email?: string): void => {}

export const clearUser = (): void => {}

export const addBreadcrumb = (_crumb: Breadcrumb): void => {}

export default {
  captureException,
  captureMessage,
  setUser,
  clearUser,
  addBreadcrumb,
}
