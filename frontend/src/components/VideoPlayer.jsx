import { useState, useRef, useCallback, useEffect } from 'react'
import { Link } from 'react-router-dom'

export default function VideoPlayer({ embedUrl, poster, animeTitle, episodeNumber, animeId, onRetry, onChangeSource }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [showTimeout, setShowTimeout] = useState(false)
  const [progressMsg, setProgressMsg] = useState('Connecting to stream...')
  const iframeRef = useRef(null)
  const timeoutRef = useRef(null)
  const progressRef = useRef(null)

  useEffect(() => {
    setLoading(true)
    setError(false)
    setShowTimeout(false)
    setRetryCount(0)
    setProgressMsg('Loading episode...')

    const steps = [
      { msg: 'Connecting to stream source...', delay: 3000 },
      { msg: 'Fetching stream source...', delay: 7000 },
      { msg: 'Preparing player...', delay: 11000 },
    ]
    steps.forEach(({ msg, delay }) => {
      progressRef.current = setTimeout(() => {
        setProgressMsg(msg)
      }, delay)
    })

    timeoutRef.current = setTimeout(() => {
      if (loading) {
        setShowTimeout(true)
        setProgressMsg('Stream is taking longer than expected...')
      }
    }, 15000)

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (progressRef.current) clearTimeout(progressRef.current)
    }
  }, [embedUrl])

  const handleLoad = useCallback(() => {
    setLoading(false)
    setShowTimeout(false)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (progressRef.current) clearTimeout(progressRef.current)
  }, [])

  const handleError_ = useCallback(() => {
    setLoading(false)
    setShowTimeout(false)
    setError(true)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (progressRef.current) clearTimeout(progressRef.current)
  }, [])

  const handleRetry = () => {
    setRetryCount((c) => c + 1)
    setError(false)
    setLoading(true)
    setShowTimeout(false)
    setProgressMsg('Loading episode...')
    if (onRetry) onRetry()
  }

  if (error) {
    return (
      <div className="relative w-full aspect-video bg-[#050816] rounded-xl overflow-hidden flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 px-6 text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <svg className="w-7 h-7 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className="text-white text-sm font-medium mb-1">Unable to load stream.</p>
            <p className="text-muted text-xs">The video source could not be reached. The stream provider may be temporarily unavailable.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRetry}
              className="bg-primary hover:bg-primary/90 text-white px-5 py-2 rounded-lg text-sm font-medium transition-all"
            >
              Retry
            </button>
            {onChangeSource && (
              <button
                onClick={onChangeSource}
                className="bg-white/10 hover:bg-white/20 text-link px-5 py-2 rounded-lg text-sm font-medium transition-all"
              >
                Change Source
              </button>
            )}
            <Link
              to={`/anime/${animeId}`}
              className="text-muted hover:text-white text-sm font-medium transition-colors"
            >
              Back To Anime
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full aspect-video bg-[#050816] rounded-xl overflow-hidden group shadow-2xl">
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#050816] z-10 p-6">
          {poster && (
            <div className="w-24 h-36 rounded-lg overflow-hidden mb-4 ring-1 ring-white/10 shadow-lg">
              <img src={poster} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          {animeTitle && (
            <p className="text-white text-sm font-medium text-center mb-1 max-w-xs truncate">{animeTitle}</p>
          )}
          {episodeNumber && (
            <p className="text-primary text-xs font-bold mb-4">Episode {episodeNumber}</p>
          )}
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mb-3" />
          <p className="text-muted text-xs text-center">{progressMsg}</p>
          {showTimeout && (
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={handleRetry}
                className="bg-primary/20 hover:bg-primary/30 text-primary text-xs px-4 py-1.5 rounded-lg transition-colors font-medium"
              >
                Reload
              </button>
              {onChangeSource && (
                <button
                  onClick={onChangeSource}
                  className="bg-white/10 hover:bg-white/20 text-link text-xs px-4 py-1.5 rounded-lg transition-colors font-medium"
                >
                  Change Source
                </button>
              )}
            </div>
          )}
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
          onError={handleError_}
          style={{ border: 'none' }}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#050816] p-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-white text-sm font-medium mb-1">No stream source available</p>
          <p className="text-muted text-xs text-center max-w-xs">
            Episodes may not be available for this anime yet. Try again later or select a different episode.
          </p>
          {onRetry && (
            <button
              onClick={handleRetry}
              className="mt-4 bg-primary hover:bg-primary/90 text-white px-5 py-2 rounded-lg text-sm font-medium transition-all"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {!loading && !error && embedUrl && (
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
