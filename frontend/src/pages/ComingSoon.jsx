import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { getAnimeById } from '../api/anime'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import ImageWithFallback, { BannerImage } from '../components/ImageWithFallback'
import { DetailSkeleton } from '../components/Skeleton'
import ErrorState from '../components/ErrorState'

function useCountdown(targetDate) {
  const calcRemaining = useCallback(() => {
    if (!targetDate) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true }
    const diff = new Date(targetDate).getTime() - Date.now()
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true }
    return {
      days: Math.floor(diff / 86400000),
      hours: Math.floor((diff % 86400000) / 3600000),
      minutes: Math.floor((diff % 3600000) / 60000),
      seconds: Math.floor((diff % 60000) / 1000),
      expired: false,
    }
  }, [targetDate])

  const [remaining, setRemaining] = useState(calcRemaining)

  useEffect(() => {
    setRemaining(calcRemaining())
    const id = setInterval(() => setRemaining(calcRemaining()), 1000)
    return () => clearInterval(id)
  }, [calcRemaining])

  return remaining
}

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
}

const stagger = {
  animate: { transition: { staggerChildren: 0.08 } },
}

function InfoRow({ label, value }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted text-sm whitespace-nowrap min-w-[90px]">{label}</span>
      <span className="text-link text-sm">{value}</span>
    </div>
  )
}

function PlaceholderSection({ title, icon, count = 4 }) {
  return (
    <motion.section variants={fadeUp} className="glass rounded-2xl p-6 border border-white/5">
      <div className="flex items-center gap-3 mb-5">
        {icon && <span className="text-2xl">{icon}</span>}
        <h3 className="text-white text-lg font-bold font-display">{title}</h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="text-center">
            <div className="rounded-xl overflow-hidden mb-2 aspect-poster skeleton" />
            <div className="h-3 w-20 mx-auto skeleton rounded" />
          </div>
        ))}
      </div>
      <p className="text-xs text-muted/60 text-center mt-4">Coming soon</p>
    </motion.section>
  )
}

function formatDate(dateStr) {
  if (!dateStr) return null
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return dateStr
  }
}

export default function ComingSoon() {
  const { id: malId } = useParams()
  const location = useLocation()
  const routeAnime = location.state?.anime

  const [anime, setAnime] = useState(routeAnime || null)
  const [loading, setLoading] = useState(!routeAnime)
  const [error, setError] = useState(false)
  const [notified, setNotified] = useState(false)
  const [reminded, setReminded] = useState(false)
  const [inWatchlist, setInWatchlist] = useState(false)
  const [copied, setCopied] = useState(false)

  useDocumentTitle(anime ? `Coming Soon - ${anime.title}` : 'Coming Soon')

  const releaseDate = anime?.aired?.from || anime?.releaseDate || null
  const countdown = useCountdown(releaseDate)

  const airingStatus = useMemo(() => {
    if (!anime?.status) return null
    const s = anime.status.toUpperCase()
    if (s === 'NOT_YET_RELEASED' || s === 'NOT_YET_AIRED') return 'NOT_YET_RELEASED'
    if (s === 'COMING_SOON') return 'COMING_SOON'
    return null
  }, [anime?.status])

  const fetchData = useCallback(async (signal) => {
    if (!malId) return
    setLoading(true)
    setError(false)
    try {
      const data = await getAnimeById(malId, signal)
      if (signal.aborted) return
      setAnime(data)
    } catch {
      setError(true)
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }, [malId])

  useEffect(() => {
    if (routeAnime) return
    const controller = new AbortController()
    fetchData(controller.signal)
    return () => controller.abort()
  }, [fetchData, routeAnime])

  const handleNotify = () => {
    setNotified(true)
    setTimeout(() => setNotified(false), 3000)
  }

  const handleRemind = () => {
    setReminded(true)
    setTimeout(() => setReminded(false), 3000)
  }

  const handleWatchlist = () => {
    setInWatchlist((p) => !p)
  }

  const handleShare = async () => {
    const url = window.location.href
    if (navigator.share) {
      try { await navigator.share({ title: anime?.title, url }) } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2500)
      } catch {}
    }
  }

  if (loading) return <DetailSkeleton />
  if (error) return <ErrorState title="Anime not found" message="Could not load this anime. It may not exist or there was a network error." onRetry={fetchData} />
  if (!anime) return <ErrorState title="Anime not found" message="No data available." />

  const trailerId = anime?.trailerUrl
    ? (anime.trailerUrl.includes('youtube.com/watch?v=')
        ? new URL(anime.trailerUrl).searchParams.get('v')
        : anime.trailerUrl.includes('youtu.be/')
          ? anime.trailerUrl.split('youtu.be/')[1]?.split('?')[0]
          : null)
    : null

  const formattedDate = formatDate(releaseDate)

  return (
    <div className="min-h-screen bg-body">
      {/* Hero Banner */}
      <div className="relative h-[60vh] min-h-[400px] md:min-h-[500px] overflow-hidden">
        <BannerImage src={anime.imageUrl} alt={anime.title} className="scale-110" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050816] via-[#050816]/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#050816]/80 via-transparent to-[#050816]/30" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#050816]" />

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 z-20 px-4 sm:px-6 lg:px-8 pt-4">
          <Link to="/" className="text-muted hover:text-white text-sm transition-colors inline-flex items-center gap-1 group">
            <svg className="w-5 h-5 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
        </div>

        {/* Status pill */}
        <div className="absolute top-4 right-4 sm:right-6 lg:right-8 z-20">
          <span className="bg-primary/20 backdrop-blur-md border border-primary/30 text-primary text-[11px] font-bold px-3 py-1.5 rounded-full tracking-wider uppercase">
            {airingStatus === 'NOT_YET_RELEASED' ? 'Not Yet Released' : 'Coming Soon'}
          </span>
        </div>

        {/* Bottom overlay content */}
        <div className="absolute bottom-0 left-0 right-0 z-10 px-4 sm:px-6 lg:px-8 pb-6 md:pb-10">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="max-w-[1440px] mx-auto"
          >
            <div className="flex items-center gap-2 mb-2">
              {anime.type && (
                <span className="text-[11px] font-bold text-white bg-primary/20 border border-primary/30 px-2.5 py-1 rounded-lg">
                  {anime.type}
                </span>
              )}
              {anime.rating && (
                <span className="text-[11px] font-bold text-white bg-primary/90 px-2.5 py-1 rounded-lg">
                  {anime.rating}
                </span>
              )}
              {anime.episodes && (
                <span className="text-xs text-muted">{anime.episodes} Episodes</span>
              )}
            </div>
            <h1 className="text-white text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold font-display mb-3 leading-tight">
              {anime.title}
            </h1>
            {anime.title_japanese && (
              <p className="text-muted/60 text-sm md:text-base font-pathway">{anime.title_japanese}</p>
            )}
          </motion.div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 -mt-24 md:-mt-32 relative z-20">
        <motion.div
          variants={stagger}
          initial="initial"
          animate="animate"
          className="flex flex-col lg:flex-row gap-6 lg:gap-10"
        >
          {/* Left Column - Poster + Action Buttons + Info */}
          <div className="w-full lg:w-72 xl:w-80 flex-shrink-0">
            <motion.div variants={fadeUp}>
              <div className="rounded-2xl overflow-hidden shadow-2xl -mt-12 md:-mt-20 border border-white/10">
                <ImageWithFallback
                  src={anime.imageUrl}
                  alt={anime.title}
                  className="w-full"
                  lazy={false}
                  aspectRatio="aspect-poster"
                />
              </div>
            </motion.div>

            {/* Countdown */}
            {!countdown.expired && (
              <motion.div variants={fadeUp} className="glass-strong rounded-2xl p-5 mt-6 text-center border border-primary/10 glow-primary">
                <p className="text-muted text-xs uppercase tracking-widest mb-3 font-medium">
                  {airingStatus === 'NOT_YET_RELEASED' ? 'Releases In' : 'Coming In'}
                </p>
                <div className="flex items-center justify-center gap-3 md:gap-4">
                  {[
                    { label: 'Days', value: countdown.days },
                    { label: 'Hours', value: countdown.hours },
                    { label: 'Mins', value: countdown.minutes },
                    { label: 'Secs', value: countdown.seconds },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex flex-col items-center">
                      <span className="text-white text-2xl md:text-3xl font-bold font-display tabular-nums leading-none">
                        {String(value).padStart(2, '0')}
                      </span>
                      <span className="text-muted text-[10px] uppercase tracking-wider mt-1">{label}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {countdown.expired && releaseDate && (
              <motion.div variants={fadeUp} className="glass-strong rounded-2xl p-5 mt-6 text-center border border-secondary/20">
                <p className="text-secondary text-sm font-medium">Expected release date</p>
                <p className="text-white text-base font-bold font-display mt-1">{formattedDate}</p>
              </motion.div>
            )}

            {/* Action Buttons */}
            <motion.div variants={fadeUp} className="mt-6 space-y-3">
              <button
                onClick={handleNotify}
                className={`w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all ${
                  notified
                    ? 'bg-primary text-white shadow-glow'
                    : 'bg-primary hover:bg-primary/90 text-white hover:shadow-glow hover:-translate-y-0.5'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {notified ? 'Notification Set!' : 'Notify Me'}
              </button>

              <button
                onClick={handleRemind}
                className={`w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all border ${
                  reminded
                    ? 'bg-white/10 text-primary border-primary/40'
                    : 'glass text-link hover:text-white hover:bg-white/10 border-white/5 hover:border-white/20 hover:-translate-y-0.5'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {reminded ? 'Reminder Set!' : 'Remind Me'}
              </button>

              <button
                onClick={handleWatchlist}
                className={`w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all border ${
                  inWatchlist
                    ? 'bg-primary/20 text-primary border-primary/30'
                    : 'glass text-link hover:text-white hover:bg-white/10 border-white/5 hover:border-white/20 hover:-translate-y-0.5'
                }`}
              >
                <svg className="w-5 h-5" fill={inWatchlist ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                {inWatchlist ? 'In Watchlist' : 'Add To Watchlist'}
              </button>

              <button
                onClick={handleShare}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all glass text-link hover:text-white hover:bg-white/10 border border-white/5 hover:border-white/20 hover:-translate-y-0.5"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                {copied ? 'Link Copied!' : 'Share'}
              </button>
            </motion.div>

            {/* Info Sidebar */}
            <motion.div variants={fadeUp} className="glass rounded-2xl p-5 mt-6 space-y-3 border border-white/5">
              {releaseDate && (
                <InfoRow label="Release" value={formattedDate} />
              )}
              {anime.source && (
                <InfoRow label="Source" value={anime.source} />
              )}
              {anime.studios && anime.studios.length > 0 && (
                <InfoRow
                  label="Studio"
                  value={anime.studios.map(s => typeof s === 'string' ? s : s.name).join(', ')}
                />
              )}
              {anime.year && (
                <InfoRow label="Year" value={anime.year} />
              )}
              {anime.score && (
                <InfoRow
                  label="Rating"
                  value={
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      {anime.score}
                    </span>
                  }
                />
              )}
              {anime.season && (
                <InfoRow
                  label="Season"
                  value={`${anime.season.charAt(0).toUpperCase() + anime.season.slice(1)}${anime.year ? ` ${anime.year}` : ''}`}
                />
              )}
              {anime.duration && (
                <InfoRow label="Duration" value={anime.duration} />
              )}
            </motion.div>
          </div>

          {/* Right Column - Main Content */}
          <div className="flex-1 min-w-0 space-y-8 pb-16">
            {/* Synopsis */}
            {anime.synopsis && (
              <motion.section variants={fadeUp} className="glass rounded-2xl p-6 border border-white/5">
                <h2 className="text-white text-lg font-bold font-display mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                  </svg>
                  Synopsis
                </h2>
                <p className="text-link/80 text-sm leading-relaxed">{anime.synopsis}</p>
              </motion.section>
            )}

            {/* Genres */}
            {anime.genres && anime.genres.length > 0 && (
              <motion.section variants={fadeUp} className="glass rounded-2xl p-6 border border-white/5">
                <h2 className="text-white text-lg font-bold font-display mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  Genres
                </h2>
                <div className="flex flex-wrap gap-2">
                  {anime.genres.map((g) => {
                    const name = typeof g === 'string' ? g : g.name
                    return (
                      <Link
                        key={name}
                        to={`/browse?genres=${name.toLowerCase()}`}
                        className="text-xs text-link bg-white/5 hover:bg-primary/20 hover:text-primary border border-white/10 hover:border-primary/30 px-3.5 py-1.5 rounded-full transition-all duration-300"
                      >
                        {name}
                      </Link>
                    )
                  })}
                </div>
              </motion.section>
            )}

            {/* Trailer */}
            {trailerId && (
              <motion.section variants={fadeUp} className="glass rounded-2xl p-6 border border-white/5">
                <h2 className="text-white text-lg font-bold font-display mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Trailer
                </h2>
                <div className="relative aspect-video rounded-xl overflow-hidden bg-surface">
                  <iframe
                    src={`https://www.youtube.com/embed/${trailerId}?autoplay=0&rel=0&showinfo=0`}
                    title="Trailer"
                    className="absolute inset-0 w-full h-full"
                    allowFullScreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    loading="lazy"
                  />
                </div>
              </motion.section>
            )}

            {/* Characters (placeholder) */}
            <motion.section variants={fadeUp}>
              <PlaceholderSection title="Characters" icon="🎭" count={6} />
            </motion.section>

            {/* Staff (placeholder) */}
            <motion.section variants={fadeUp}>
              <PlaceholderSection title="Staff" icon="🎬" count={5} />
            </motion.section>

            {/* Theme Songs (placeholder) */}
            <motion.section variants={fadeUp} className="glass rounded-2xl p-6 border border-white/5">
              <div className="flex items-center gap-3 mb-5">
                <span className="text-2xl">🎵</span>
                <h3 className="text-white text-lg font-bold font-display">Theme Songs</h3>
              </div>
              <div className="space-y-3">
                {['OP', 'ED'].map((type) => (
                  <div key={type} className="flex items-center gap-4 bg-white/[0.02] rounded-xl p-4 border border-white/5">
                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded-lg uppercase tracking-wider">
                      {type}
                    </span>
                    <div className="flex-1">
                      <div className="h-3 w-48 skeleton rounded mb-2" />
                      <div className="h-2.5 w-28 skeleton rounded" />
                    </div>
                    <span className="text-muted/40 text-xs">TBD</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted/60 text-center mt-4">Theme songs will be added closer to release</p>
            </motion.section>

            {/* Related Anime (placeholder) */}
            <motion.section variants={fadeUp}>
              <PlaceholderSection title="Related Anime" icon="🔗" count={4} />
            </motion.section>

            {/* Recommendations (placeholder) */}
            <motion.section variants={fadeUp}>
              <PlaceholderSection title="Recommendations" icon="⭐" count={6} />
            </motion.section>

            {/* Discussion */}
            <motion.section variants={fadeUp} className="glass rounded-2xl p-6 border border-white/5">
              <h2 className="text-white text-lg font-bold font-display mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Discussion
              </h2>
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="text-muted text-sm">Discussion board will be available closer to release</p>
                <p className="text-muted/50 text-xs mt-1">Join the conversation when the anime airs</p>
              </div>
            </motion.section>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
