import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { getAnimeById, getAnimeBySlug, getReviews, addReview, getEpisodes, getTrending } from '../api/anime'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { addFavorite, removeFavorite, getFavorites } from '../api/favorite'
import { addToWatchlist, getWatchlist, removeFromWatchlist, updateWatchlistStatus } from '../api/watchlist'
import { deleteReview } from '../api/review'
import { useAuth } from '../context/AuthContext'
import ImageWithFallback, { BannerImage } from '../components/ImageWithFallback'
import { EpisodeGridCard } from '../components/EpisodeCard'
import { DetailSkeleton } from '../components/Skeleton'
import ErrorState from '../components/ErrorState'
import SectionRow from '../components/SectionRow'
import AnimeCard from '../components/AnimeCard'

export default function AnimeDetail() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()
  const [anime, setAnime] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  useDocumentTitle(anime?.title)
  const [reviews, setReviews] = useState([])
  const [reviewPage, setReviewPage] = useState(0)
  const [reviewTotalPages, setReviewTotalPages] = useState(0)
  const [isFavorited, setIsFavorited] = useState(false)
  const [watchlistStatus, setWatchlistStatus] = useState(null)
  const [watchlistId, setWatchlistId] = useState(null)
  const [episodes, setEpisodes] = useState([])
  const [starRating, setStarRating] = useState(5)
  const [comment, setComment] = useState('')
  const [reviewMsg, setReviewMsg] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showAllEpisodes, setShowAllEpisodes] = useState(false)

  const isNumeric = /^\d+$/.test(slug)

  const fetchData = useCallback(async (signal) => {
    setLoading(true)
    setError(false)
    try {
      const data = isNumeric
        ? await getAnimeById(parseInt(slug), signal)
        : await getAnimeBySlug(slug, signal)
      if (signal.aborted) return
      setAnime(data)
    } catch {
      setError(true)
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }, [slug, isNumeric])

  useEffect(() => {
    const controller = new AbortController()
    fetchData(controller.signal)
    return () => controller.abort()
  }, [fetchData])

  useEffect(() => {
    if (!anime?.malId) return
    const controller = new AbortController()
    getEpisodes(anime.malId, controller.signal).then((eps) => {
      if (controller.signal.aborted) return
      const unique = []
      const seen = new Set()
      for (const ep of eps) {
        if (!seen.has(ep.episodeNumber)) {
          seen.add(ep.episodeNumber)
          unique.push(ep)
        }
      }
      unique.sort((a, b) => a.episodeNumber - b.episodeNumber)
      setEpisodes(unique)
    }).catch(() => {})
    return () => controller.abort()
  }, [anime?.malId])

  useEffect(() => {
    if (!anime?.id) return
    const controller = new AbortController()
    getReviews(anime.id, reviewPage, 10, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return
        setReviews(res.content || [])
        setReviewTotalPages(res.totalPages || 1)
      })
      .catch(() => {})
    return () => controller.abort()
  }, [anime?.id, reviewPage])

  useEffect(() => {
    if (!isAuthenticated || !anime?.id) return
    const controller = new AbortController()
    getFavorites(controller.signal).then((list) => {
      if (controller.signal.aborted) return
      setIsFavorited((list || []).some((f) => f.anime?.id === anime.id))
    }).catch(() => {})
    getWatchlist(controller.signal).then((list) => {
      if (controller.signal.aborted) return
      const found = (list || []).find((e) => e.anime?.id === anime.id)
      if (found) {
        setWatchlistStatus(found.status)
        setWatchlistId(found.id)
      }
    }).catch(() => {})
    return () => controller.abort()
  }, [isAuthenticated, anime?.id])

  const trendingQ = useQuery({
    queryKey: ['trending-recs'],
    queryFn: ({ signal }) => getTrending(0, 20, signal),
    staleTime: 300000,
  })

  const recommendations = useMemo(() => {
    const data = trendingQ.data?.data || []
    if (!anime) return data
    return data.filter(a => (a.malId || a.id) !== (anime.malId || anime.id)).slice(0, 20)
  }, [trendingQ.data, anime])

  const relatedAnime = useMemo(() => {
    if (!anime?.related?.length) return []
    return anime.related.slice(0, 10)
  }, [anime])

  const handleFavorite = async () => {
    if (!anime?.id) return
    try {
      if (isFavorited) { await removeFavorite(anime.id); setIsFavorited(false) }
      else { await addFavorite(anime.id); setIsFavorited(true) }
    } catch {}
  }

  const handleWatchlist = async (status) => {
    if (!anime?.id) return
    try {
      if (watchlistStatus === status) {
        await removeFromWatchlist(watchlistId)
        setWatchlistStatus(null)
        setWatchlistId(null)
      } else if (watchlistStatus) {
        await updateWatchlistStatus(watchlistId, status)
        setWatchlistStatus(status)
      } else {
        const entry = await addToWatchlist(anime.id, status)
        setWatchlistStatus(status)
        setWatchlistId(entry?.id)
      }
    } catch {}
  }

  const handleReview = async (e) => {
    e.preventDefault()
    if (!anime?.id) return
    setReviewMsg('')
    setSubmitting(true)
    try {
      await addReview(anime.id, starRating, comment)
      setReviewMsg('Review posted!')
      setComment('')
      setStarRating(5)
      getReviews(anime.id, 0, 10).then((res) => {
        setReviews(res.content || [])
        setReviewPage(0)
      })
    } catch (err) {
      setReviewMsg(err?.response?.data?.message || err?.message || 'Failed to post review')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <DetailSkeleton />
  if (error) return <ErrorState title="Anime not found" message="Could not load anime details." onRetry={fetchData} />
  if (!anime) return <ErrorState title="Anime not found" message="No data available for this anime." />

  const episodeCount = anime.episodes ? `${anime.episodes} Episodes` : `${episodes.length || '?'} Episodes`
  const genres = anime.genres?.map(g => typeof g === 'string' ? g : g.name).filter(Boolean) || []
  const studios = anime.studios?.map(s => typeof s === 'string' ? s : s.name).filter(Boolean) || []
  const bgImage = anime.imageUrl || anime.images?.jpg?.large_image_url
  const displayEpisodes = showAllEpisodes ? episodes : episodes.slice(0, 12)

  return (
    <div>
      <div className="relative h-[50vh] min-h-[400px] overflow-hidden">
        <BannerImage src={bgImage} alt="" className="scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#080A16] via-[#080A16]/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#080A16]/80 via-[#080A16]/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-6 lg:px-8 pb-6 max-w-[1440px] mx-auto">
          <button onClick={() => navigate(-1)} className="text-white/50 hover:text-white text-sm transition-colors inline-flex items-center gap-1 mb-3">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 -mt-36 relative z-10">
        <div className="flex flex-col lg:flex-row gap-8 mb-12">
          <div className="w-full lg:w-64 flex-shrink-0">
            <div className="rounded-[16px] overflow-hidden shadow-2xl -mt-16 lg:-mt-32 ring-2 ring-white/[0.08] lg:sticky lg:top-24">
              <ImageWithFallback src={bgImage} alt={anime.title} className="w-full" lazy={false} />
            </div>
          </div>

          <div className="flex-1 pt-4 lg:pt-0">
            <div className="flex flex-wrap items-center gap-2.5 mb-4">
              {anime.type && (
                <span className="text-[11px] font-bold text-white bg-primary/15 border border-primary/25 px-2.5 py-1 rounded-lg">
                  {anime.type}
                </span>
              )}
              {anime.score && (
                <span className="flex items-center gap-1 text-xs font-bold text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 px-2.5 py-1 rounded-lg">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  {anime.score}
                </span>
              )}
              <span className="text-xs text-[#9CA3AF]">{episodeCount}</span>
              {anime.year && <span className="text-xs text-[#9CA3AF]">{anime.year}</span>}
              {anime.status && (
                <span className={`text-xs px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${
                  anime.status.toLowerCase().includes('airing')
                    ? 'text-emerald-400 border-emerald-500/25 bg-emerald-500/10'
                    : anime.status.toLowerCase().includes('finished') || anime.status.toLowerCase().includes('complete')
                    ? 'text-blue-400 border-blue-500/25 bg-blue-500/10'
                    : 'text-cyan-400 border-cyan-500/25 bg-cyan-500/10'
                }`}>
                  {anime.status.toLowerCase().includes('airing') && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                  {anime.status}
                </span>
              )}
            </div>

            <h1 className="text-white text-2xl md:text-3xl lg:text-4xl font-bold font-display mb-2">{anime.title}</h1>
            {anime.titleJapanese && (
              <p className="text-[#9CA3AF]/60 text-sm mb-1">{anime.titleJapanese}</p>
            )}
            {anime.titleEnglish && anime.titleEnglish !== anime.title && (
              <p className="text-[#9CA3AF]/40 text-xs mb-4">{anime.titleEnglish}</p>
            )}

            {genres.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {genres.map((g) => (
                  <Link key={g} to={`/browse?genres=${g.toLowerCase()}`} className="text-xs text-[#D1D5DB] bg-white/[0.04] hover:bg-primary/15 hover:text-primary border border-white/[0.06] hover:border-primary/25 px-3 py-1 rounded-full transition-all duration-300">
                    {g}
                  </Link>
                ))}
              </div>
            )}

            <p className="text-[#D1D5DB]/60 text-sm leading-relaxed mb-6 max-w-3xl">
              {anime.synopsis || 'No synopsis available.'}
            </p>

            <div className="flex flex-wrap items-center gap-3 mb-6">
              <Link
                to={`/anime/${anime.slug || anime.malId || anime.id}/ep/1`}
                className="bg-primary hover:bg-primary/90 text-white px-7 py-2.5 rounded-xl text-sm font-semibold transition-all hover:shadow-glow hover:-translate-y-0.5 active:scale-95 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
                Watch Now
              </Link>
              {anime.trailerUrl && (
                <a href={anime.trailerUrl} target="_blank" rel="noopener noreferrer" className="text-[#D1D5DB] hover:text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-all hover:bg-white/[0.06] flex items-center gap-2 border border-white/[0.06] hover:border-white/[0.12]">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Trailer
                </a>
              )}
              {isAuthenticated && (
                <>
                  <button onClick={handleFavorite} className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 active:scale-95 ${isFavorited ? 'bg-primary/15 text-primary border border-primary/25' : 'text-[#D1D5DB] hover:text-white border border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.04]'}`}>
                    <svg className="w-5 h-5" fill={isFavorited ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    {isFavorited ? 'Favorited' : 'Favorite'}
                  </button>
                  <div className="flex gap-2">
                    {['WATCHING', 'COMPLETED', 'PLAN_TO_WATCH'].map((s) => (
                      <button key={s} onClick={() => handleWatchlist(s)} className={`px-4 py-2.5 rounded-xl text-xs font-medium transition-all active:scale-95 ${watchlistStatus === s ? 'bg-primary/15 text-primary border border-primary/25' : 'text-[#D1D5DB] hover:text-white border border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.04]'}`}>
                        {s === 'WATCHING' ? 'Watching' : s === 'COMPLETED' ? 'Completed' : 'Plan'}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <InfoTile label="Studio" value={studios.join(', ') || 'N/A'} />
              <InfoTile label="Episodes" value={String(anime.episodes || episodes.length || '?')} />
              <InfoTile label="Duration" value={anime.duration || 'N/A'} />
              <InfoTile label="Status" value={anime.status || 'N/A'} />
              <InfoTile label="Aired" value={anime.aired || anime.year || 'N/A'} />
              <InfoTile label="Score" value={anime.score ? `${anime.score}/10` : 'N/A'} />
              <InfoTile label="Season" value={anime.season ? `${anime.season} ${anime.year || ''}` : 'N/A'} />
              <InfoTile label="Source" value={anime.source || 'N/A'} />
              <InfoTile label="Popularity" value={anime.popularity ? `#${anime.popularity}` : 'N/A'} />
              <InfoTile label="Members" value={anime.members?.toLocaleString() || 'N/A'} />
              <InfoTile label="Favorites" value={anime.favorites?.toLocaleString() || 'N/A'} />
              <InfoTile label="Rating" value={anime.rating || 'N/A'} />
            </div>
          </div>
        </div>

        {anime.trailerUrl && (
          <section className="mb-12">
            <h2 className="text-white text-xl font-bold font-display mb-6">Trailer</h2>
            <div className="aspect-video rounded-[16px] overflow-hidden bg-black shadow-2xl">
              <iframe
                src={anime.trailerUrl.replace('watch?v=', 'embed/')}
                className="w-full h-full"
                allowFullScreen
                allow="autoplay; fullscreen"
                title={`${anime.title} Trailer`}
              />
            </div>
          </section>
        )}

        {episodes.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white text-xl font-bold font-display">Episodes</h2>
              <div className="flex items-center gap-3">
                <span className="text-sm text-[#9CA3AF]">{episodes.length} total</span>
                {episodes.length > 12 && (
                  <button
                    onClick={() => setShowAllEpisodes(!showAllEpisodes)}
                    className="text-sm text-primary hover:text-primary/80 transition-colors font-medium"
                  >
                    {showAllEpisodes ? 'Show Less' : 'View All'}
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {displayEpisodes.map((ep) => (
                <EpisodeGridCard key={ep.id || ep.episodeNumber} episode={ep} animeId={anime.malId || anime.id} animeSlug={anime.slug} />
              ))}
            </div>
          </section>
        )}

        {recommendations.length > 0 && (
          <section className="mb-12">
            <SectionRow
              title="You May Also Like"
              viewAllLink="/trending"
              items={recommendations}
              isLoading={trendingQ.isLoading}
            />
          </section>
        )}

        <section className="mb-12">
          <h2 className="text-white text-xl font-bold font-display mb-6">Reviews</h2>

          {isAuthenticated && (
            <motion.form initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} onSubmit={handleReview} className="bg-card/50 backdrop-blur-sm p-6 rounded-2xl mb-8 border border-white/[0.04]">
              {reviewMsg && (
                <p className={`text-sm mb-4 ${reviewMsg.includes('Failed') || reviewMsg.includes('already') ? 'text-red-400' : 'text-green-400'}`}>
                  {reviewMsg}
                </p>
              )}
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[#9CA3AF] text-sm">Rating:</span>
                {[1, 2, 3, 4, 5].map((s) => (
                  <button key={s} type="button" onClick={() => setStarRating(s)} className={`text-2xl transition-colors ${s <= starRating ? 'text-primary' : 'text-[#9CA3AF] hover:text-primary/50'}`} aria-label={`Rate ${s} stars`}>★</button>
                ))}
              </div>
              <textarea placeholder="Share your thoughts about this anime..." value={comment} onChange={(e) => setComment(e.target.value)} rows={3} className="w-full bg-white/[0.04] text-[#D1D5DB] px-4 py-3 rounded-xl border border-white/[0.06] focus:border-primary/50 outline-none transition resize-none mb-4 placeholder-[#9CA3AF]/50" />
              <button type="submit" disabled={submitting || !comment.trim()} className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-all hover:shadow-glow disabled:opacity-50 disabled:cursor-not-allowed active:scale-95">
                {submitting ? 'Posting...' : 'Post Review'}
              </button>
            </motion.form>
          )}

          {reviews.length === 0 ? (
            <p className="text-[#9CA3AF] text-sm">No reviews yet. Be the first to share your thoughts!</p>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <motion.div key={review.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card/30 backdrop-blur-sm p-5 rounded-2xl border border-white/[0.04]">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold">
                        {review.user?.name?.charAt(0)?.toUpperCase() || 'A'}
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">{review.user?.name || 'Anonymous'}</p>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <span key={s} className={`text-xs ${s <= review.starRating ? 'text-primary' : 'text-[#9CA3AF]'}`}>★</span>
                          ))}
                        </div>
                      </div>
                    </div>
                    {(review.user?.id === user?.id) && (
                      <button onClick={() => deleteReview(review.id).then(() => { getReviews(anime.id, reviewPage, 10).then((r) => setReviews(r.content || [])) })} className="text-xs text-[#9CA3AF] hover:text-red-400 transition-colors">Delete</button>
                    )}
                  </div>
                  <p className="text-[#D1D5DB]/60 text-sm leading-relaxed">{review.comment}</p>
                </motion.div>
              ))}
              {reviewTotalPages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-6">
                  <button onClick={() => setReviewPage(p => Math.max(0, p - 1))} disabled={reviewPage === 0} className="px-4 py-2 rounded-lg text-sm text-[#9CA3AF] hover:text-white bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-30 transition-all">Previous</button>
                  <span className="text-[#9CA3AF] text-sm">{reviewPage + 1} / {reviewTotalPages}</span>
                  <button onClick={() => setReviewPage(p => Math.min(reviewTotalPages - 1, p + 1))} disabled={reviewPage >= reviewTotalPages - 1} className="px-4 py-2 rounded-lg text-sm text-[#9CA3AF] hover:text-white bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-30 transition-all">Next</button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function InfoTile({ label, value }) {
  return (
    <div className="bg-white/[0.02] rounded-[14px] p-3 border border-white/[0.04]">
      <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-white text-xs font-medium">{value}</p>
    </div>
  )
}
