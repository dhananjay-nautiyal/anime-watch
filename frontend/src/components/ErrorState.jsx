import { Link } from 'react-router-dom'

export default function ErrorState({ 
  title = 'Something went wrong', 
  message = 'An unexpected error occurred.',
  onRetry,
  compact = false 
}) {
  if (compact) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-3">
          <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p className="text-muted text-sm mb-3">{message}</p>
        {onRetry && (
          <button onClick={onRetry} className="text-primary text-sm font-medium hover:underline">
            Try again
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] px-4">
      <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
        <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h2 className="text-white text-xl font-bold font-display mb-2">{title}</h2>
      <p className="text-muted text-sm mb-8 max-w-md text-center">{message}</p>
      <div className="flex items-center gap-3">
        {onRetry && (
          <button onClick={onRetry} className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-all hover:shadow-glow">
            Retry
          </button>
        )}
        <Link to="/" className="glass text-link hover:text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-all hover:bg-white/10">
          Go Home
        </Link>
      </div>
    </div>
  )
}

export function EpisodeError({ onRetry, onChangeSource }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      </div>
      <p className="text-white text-sm font-medium mb-1">Episode unavailable</p>
      <p className="text-muted text-xs mb-6">Could not load video stream</p>
      <div className="flex items-center gap-3">
        {onRetry && (
          <button onClick={onRetry} className="bg-primary hover:bg-primary/90 text-white px-5 py-2 rounded-lg text-sm font-medium transition-all">
            Retry
          </button>
        )}
        {onChangeSource && (
          <button onClick={onChangeSource} className="glass text-link hover:text-white px-5 py-2 rounded-lg text-sm font-medium transition-all">
            Change Source
          </button>
        )}
      </div>
    </div>
  )
}

export function NotFound({ message = 'Page not found' }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] px-4">
      <h1 className="text-6xl font-black font-display text-primary mb-4">404</h1>
      <p className="text-muted text-sm">{message}</p>
    </div>
  )
}
