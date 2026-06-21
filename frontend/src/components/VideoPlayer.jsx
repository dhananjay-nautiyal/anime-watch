import { useState, useRef, useCallback, useEffect } from 'react'
import { Link } from 'react-router-dom'

export default function VideoPlayer({ embedUrl, poster, animeTitle, episodeNumber, animeId, onRetry, onChangeSource }) {
  const [userClicked, setUserClicked] = useState(false)
  const [iframeLoading, setIframeLoading] = useState(false)
  const [error, setError] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const iframeRef = useRef(null)

  useEffect(() => {
    setIframeLoading(true)
    setError(false)
    setRetryCount(0)
  }, [embedUrl])

  const handleWatch = () => {
    setUserClicked(true)
    setIframeLoading(true)
    setError(false)
  }

  const handleLoad = useCallback(() => {
    setIframeLoading(false)
  }, [])

  const handleError_ = useCallback(() => {
    setIframeLoading(false)
    setError(true)
  }, [])

  const handleRetry = () => {
    setRetryCount((c) => c + 1)
    setError(false)
    setIframeLoading(true)
    if (onRetry) onRetry()
  }

  const showPoster = !userClicked && !error

  if (error && !embedUrl) {
    return (
      <div className="relative w-full aspect-video bg-[#050816] rounded-xl overflow-hidden flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 px-6 text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <svg className="w-7 h-7 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className="text-white text-sm font-medium mb-1">Stream source unavailable.</p>
            <p className="text-muted text-xs">No embed URL could be retrieved. Try a different episode or provider.</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleRetry} className="bg-primary hover:bg-primary/90 text-white px-5 py-2 rounded-lg text-sm font-medium transition-all">Retry</button>
            {onChangeSource && <button onClick={onChangeSource} className="bg-white/10 hover:bg-white/20 text-link px-5 py-2 rounded-lg text-sm font-medium transition-all">Change Source</button>}
            <Link to={`/anime/${animeId}`} className="text-muted hover:text-white text-sm font-medium transition-colors">Back To Anime</Link>
          </div>
        </div>
      </div>
    )
  }

  if (error && embedUrl) {
    return (
      <div className="relative w-full aspect-video bg-[#050816] rounded-xl overflow-hidden flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 px-6 text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <svg className="w-7 h-7 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className="text-white text-sm font-medium mb-1">Could not load player.</p>
            <p className="text-muted text-xs">The iframe may have been blocked or refused to load.</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleRetry} className="bg-primary hover:bg-primary/90 text-white px-5 py-2 rounded-lg text-sm font-medium transition-all">Retry</button>
            {onChangeSource && <button onClick={onChangeSource} className="bg-white/10 hover:bg-white/20 text-link px-5 py-2 rounded-lg text-sm font-medium transition-all">Change Source</button>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full aspect-video bg-[#050816] rounded-xl overflow-hidden group shadow-2xl">
      {/* Poster overlay with Watch button */}
      {showPoster && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm cursor-pointer" onClick={handleWatch}>
          {poster && (
            <>
              <img src={poster} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#050816] via-black/40 to-[#050816]/60" />
            </>
          )}
          <div className="relative z-10 flex flex-col items-center gap-4">
            {animeTitle && <p className="text-white text-sm font-medium text-center max-w-xs truncate">{animeTitle}</p>}
            {episodeNumber && <p className="text-primary text-xs font-bold">Episode {episodeNumber}</p>}
            <button
              onClick={(e) => { e.stopPropagation(); handleWatch() }}
              className="w-16 h-16 rounded-full bg-primary/90 hover:bg-primary shadow-lg shadow-primary/30 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
            >
              <svg className="w-7 h-7 text-white ml-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
            </button>
            <span className="text-white text-xs font-medium">Watch</span>
          </div>
        </div>
      )}

      {/* Loading spinner */}
      {userClicked && iframeLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#050816] z-10 p-6">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mb-3" />
          <p className="text-muted text-xs">Loading player...</p>
        </div>
      )}

      {/* Iframe */}
      {userClicked && embedUrl ? (
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
      ) : userClicked && !embedUrl ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#050816] p-6">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mb-3" />
          <p className="text-muted text-xs">Fetching stream source...</p>
          <button onClick={handleRetry} className="mt-4 bg-primary/20 hover:bg-primary/30 text-primary text-xs px-4 py-1.5 rounded-lg transition-colors font-medium">Retry</button>
        </div>
      ) : null}

      {/* overlay controls */}
      {userClicked && !iframeLoading && !error && embedUrl && (
        <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
          <div className="flex items-center gap-2">
            <button onClick={handleRetry} className="bg-black/60 backdrop-blur-sm text-white hover:bg-black/80 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">Reload</button>
            {onChangeSource && <button onClick={onChangeSource} className="bg-black/60 backdrop-blur-sm text-white hover:bg-black/80 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">Change Source</button>}
          </div>
        </div>
      )}
    </div>
  )
}
