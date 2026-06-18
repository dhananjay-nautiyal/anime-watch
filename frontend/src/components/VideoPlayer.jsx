import { useState, useRef, useCallback, useEffect } from 'react'
import { EpisodeError } from './ErrorState'

const PROXY_BASE = '/api/anime/proxy/animepahe?url='

export default function VideoPlayer({ embedUrl, onRetry, onChangeSource }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const iframeRef = useRef(null)

  useEffect(() => {
    setLoading(true)
    setError(false)
  }, [embedUrl])

  const handleLoad = useCallback(() => {
    setLoading(false)
  }, [])

  const handleError = useCallback(() => {
    setLoading(false)
    setError(true)
  }, [])

  const handleRetry = () => {
    setRetryCount(c => c + 1)
    setError(false)
    setLoading(true)
    if (onRetry) onRetry()
  }

  if (error) {
    return (
      <EpisodeError
        onRetry={handleRetry}
        onChangeSource={onChangeSource}
      />
    )
  }

  return (
    <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden group shadow-2xl">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
            <p className="text-muted text-xs font-medium">Loading stream...</p>
          </div>
        </div>
      )}

      {embedUrl ? (
        <iframe
          ref={iframeRef}
          key={`${embedUrl}-${retryCount}`}
          src={embedUrl}
          className="w-full h-full"
          allowFullScreen
          allow="autoplay; fullscreen; picture-in-picture"
          title="Video player"
          onLoad={handleLoad}
          onError={handleError}
          style={{ border: 'none' }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <p className="text-muted text-sm">No stream source available</p>
        </div>
      )}

      {!loading && !error && (
        <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
          <div className="flex items-center gap-2">
            <button
              onClick={handleRetry}
              className="bg-black/60 backdrop-blur-sm text-white hover:bg-black/80 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            >
              Reload
            </button>
            {onChangeSource && (
              <button
                onClick={onChangeSource}
                className="bg-black/60 backdrop-blur-sm text-white hover:bg-black/80 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              >
                Change Source
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
