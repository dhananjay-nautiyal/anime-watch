import { addBreadcrumb } from '@/app/sentry'

type EventName =
  | 'screen_view'
  | 'anime_view'
  | 'episode_play'
  | 'episode_pause'
  | 'episode_complete'
  | 'search'
  | 'filter_genre'
  | 'add_favorite'
  | 'remove_favorite'
  | 'add_watchlist'
  | 'remove_watchlist'
  | 'download_start'
  | 'download_complete'
  | 'download_delete'
  | 'notification_open'
  | 'notification_toggle'
  | 'login'
  | 'register'
  | 'logout'
  | 'share'
  | 'error'

let analyticsEnabled = true

export function setAnalyticsEnabled(enabled: boolean) {
  analyticsEnabled = enabled
}

export function trackEvent(name: EventName, properties?: Record<string, string | number | boolean>) {
  if (!analyticsEnabled) return

  const sanitized: Record<string, string | number | boolean> = {}
  for (const [k, v] of Object.entries(properties || {})) {
    if (v !== undefined) sanitized[k] = v as string | number | boolean
  }

  addBreadcrumb({
    message: `Event: ${name}`,
    category: 'analytics',
  })

  if (__DEV__) {
    console.log(`[Analytics] ${name}`, sanitized)
  }
}

export function trackScreenView(screenName: string) {
  trackEvent('screen_view', { screen: screenName })
}

export function trackError(error: Error, context?: string) {
  const props: Record<string, string | number | boolean> = { message: error.message }
  if (context) props.context = context
  trackEvent('error', props)
}
