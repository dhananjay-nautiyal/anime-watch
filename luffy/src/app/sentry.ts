import * as SentryExpo from 'sentry-expo'

const NativeSentry = SentryExpo.Native

SentryExpo.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN || 'https://your-dsn@sentry.io/your-project-id',
  tracesSampleRate: 1.0,
  environment: process.env.APP_ENV || 'development',
  enableAutoPerformanceTracing: true,
  debug: false,
})

export const captureException = (error: Error, context?: Record<string, any>) => {
  NativeSentry.captureException(error, { extra: context })
}

export const captureMessage = (message: string) => {
  NativeSentry.captureMessage(message)
}

export const setUser = (userId: string, email?: string) => {
  NativeSentry.setUser({ id: userId, email })
}

export const clearUser = () => {
  NativeSentry.setUser(null)
}

export const addBreadcrumb = (crumb: { message: string; category?: string }) => {
  NativeSentry.addBreadcrumb(crumb)
}

export default SentryExpo
