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
          <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

export function NotFound({ message = 'Page not found' }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] px-4">
      <h1 className="text-6xl font-black font-display text-primary mb-4">404</h1>
      <p className="text-muted text-sm">{message}</p>
    </div>
  )
}
