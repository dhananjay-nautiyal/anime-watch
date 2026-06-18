import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { getAnimeById, getReviews, addReview, getEpisodes } from '../api/anime'
import { addFavorite, removeFavorite, getFavorites } from '../api/favorite'
import { addToWatchlist, getWatchlist, removeFromWatchlist, updateWatchlistStatus } from '../api/watchlist'
import { deleteReview } from '../api/review'
import { useAuth } from '../context/AuthContext'
import ImageWithFallback, { BannerImage } from '../components/ImageWithFallback'
import { EpisodeGridCard } from '../components/EpisodeCard'
import { DetailSkeleton } from '../components/Skeleton'
import ErrorState from '../components/ErrorState'

export default function AnimeDetail() {
  const { id: malId } = useParams()
  const { isAuthenticated, user } = useAuth()
  const [anime, setAnime] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
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

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const data = await getAnimeById(malId)
      setAnime(data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [malId])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    if (!anime?.malId) return
    getEpisodes(anime.malId).then((eps) => {
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
  }, [anime?.malId])

  useEffect(() => {
    if (!anime?.id) return
    getReviews(anime.id, reviewPage, 10)
      .then((res) => {
        setReviews(res.content || [])
        setReviewTotalPages(res.totalPages || 1)
      })
      .catch(() => {})
  }, [anime?.id, reviewPage])

  useEffect(() => {
    if (isAuthenticated && anime?.id) {
      getFavorites().then((list) => {
        setIsFavorited((list || []).some((f) => f.anime?.id === anime.id))
      }).catch(() => {})
      getWatchlist().then((list) => {
        const found = (list || []).find((e) => e.anime?.id === anime.id)
        if (found) {
          setWatchlistStatus(found.status)
          setWatchlistId(found.id)
        }
      }).catch(() => {})
    }
  }, [isAuthenticated, anime?.id])

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
  if (error) return <ErrorState title="Anime not found" message="Could not load anime details. It may not exist or there was a network error." onRetry={fetchData} />
  if (!anime) return <ErrorState title="Anime not found" message="No data available for this anime." />

  const episodeCount = anime.episodes ? `${anime.episodes} Episodes` : 'Unknown Episodes'

  return (
    <div>
      <div className="relative h-[45vh] min-h-[300px] overflow-hidden">
        <BannerImage src={anime.imageUrl} alt="" className="scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#070B14] via-[#070B14]/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#070B14]/60 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-6 lg:px-8 pb-6">
          <Link to="/" className="text-muted hover:text-white text-sm transition-colors inline-flex items-center gap-1 mb-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 -mt-32 relative z-10">
        <div className="flex flex-col lg:flex-row gap-8 mb-12">
          <div className="w-full lg:w-64 flex-shrink-0">
            <div className="rounded-xl overflow-hidden shadow-2xl -mt-16 lg:-mt-32">
              <ImageWithFallback
                src={anime.imageUrl}
                alt={anime.title}
                className="w-full"
                lazy={false}
              />
            </div>
          </div>

          <div className="flex-1 pt-4 lg:pt-0">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-[11px] font-bold text-white bg-primary/20 border border-primary/30 px-2.5 py-1 rounded-lg">
                {anime.type || 'TV'}
              </span>
              {anime.rating && (
                <span className="text-[11px] font-bold text-white bg-primary/90 px-2.5 py-1 rounded-lg">{anime.rating}</span>
              )}
              <span className="text-xs text-muted">{episodeCount}</span>
              {anime.year && (
                <span className="text-xs text-muted">{anime.year}</span>
              )}
              {anime.status && (
                <span className="text-xs text-secondary px-2 py-0.5 border border-secondary/30 rounded-lg">{anime.status}</span>
              )}
            </div>

            <h1 className="text-white text-2xl md:text-3xl lg:text-4xl font-bold font-display mb-4">{anime.title}</h1>

            {anime.genres && anime.genres.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {anime.genres.map((g) => (
                  <Link key={typeof g === 'string' ? g : g.mal_id} to={`/browse?genres=${(typeof g === 'string' ? g : g.name).toLowerCase()}`} className="text-xs text-link bg-white/5 hover:bg-white/10 px-3 py-1 rounded-full transition-colors">
                    {typeof g === 'string' ? g : g.name}
                  </Link>
                ))}
              </div>
            )}

            <p className="text-link/70 text-sm leading-relaxed mb-6 max-w-3xl">
              {anime.synopsis || 'No synopsis available.'}
            </p>

            <div className="flex flex-wrap items-center gap-3 mb-6">
              <Link
                to={`/watch/${anime.malId || anime.id}/1`}
                className="bg-primary hover:bg-primary/90 text-white px-7 py-2.5 rounded-xl text-sm font-semibold transition-all hover:shadow-glow hover:-translate-y-0.5 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
                Watch Now
              </Link>
              {anime.trailerUrl && (
                <a href={anime.trailerUrl} target="_blank" rel="noopener noreferrer" className="glass text-link hover:text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-all hover:bg-white/10 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Trailer
                </a>
              )}
              {isAuthenticated && (
                <>
                  <button
                    onClick={handleFavorite}
                    className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                      isFavorited
                        ? 'bg-primary/20 text-primary border border-primary/30'
                        : 'glass text-link hover:text-white hover:bg-white/10 border border-transparent'
                    }`}
                  >
                    <svg className="w-4 h-4" fill={isFavorited ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    {isFavorited ? 'Favorited' : 'Favorite'}
                  </button>
                  <div className="flex gap-2">
                    {['WATCHING', 'COMPLETED', 'PLAN_TO_WATCH'].map((s) => (
                      <button
                        key={s}
                        onClick={() => handleWatchlist(s)}
                        className={`px-4 py-2.5 rounded-xl text-xs font-medium transition-all ${
                          watchlistStatus === s
                            ? 'bg-primary/20 text-primary border border-primary/30'
                            : 'glass text-link hover:text-white hover:bg-white/10 border border-transparent'
                        }`}
                      >
                        {s === 'WATCHING' ? 'Watching' : s === 'COMPLETED' ? 'Completed' : 'Plan'}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {anime.studios && anime.studios.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted">
                <span>Studio:</span>
                <span className="text-link">{anime.studios.map(s => typeof s === 'string' ? s : s.name).join(', ')}</span>
              </div>
            )}
          </div>
        </div>

        {episodes.length > 0 && (
          <section className="mb-12">
            <h2 className="text-white text-xl font-bold font-display mb-6">Episodes</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {episodes.slice(0, 50).map((ep) => (
                <EpisodeGridCard
                  key={ep.id || ep.episodeNumber}
                  episode={ep}
                  animeId={anime.malId || anime.id}
                />
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-white text-xl font-bold font-display mb-6">Reviews</h2>

          {isAuthenticated && (
            <motion.form
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onSubmit={handleReview}
              className="bg-surface/50 backdrop-blur-sm p-6 rounded-2xl mb-8 border border-white/5"
            >
              {reviewMsg && (
                <p className={`text-sm mb-4 ${reviewMsg.includes('Failed') || reviewMsg.includes('already') ? 'text-red-400' : 'text-green-400'}`}>
                  {reviewMsg}
                </p>
              )}
              <div className="flex items-center gap-2 mb-4">
                <span className="text-muted text-sm">Rating:</span>
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStarRating(s)}
                    className={`text-2xl transition-colors ${s <= starRating ? 'text-primary' : 'text-muted hover:text-primary/50'}`}
                    aria-label={`Rate ${s} stars`}
                  >
                    ★
                  </button>
                ))}
              </div>
              <textarea
                placeholder="Share your thoughts about this anime..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                className="w-full bg-white/5 text-link px-4 py-3 rounded-xl border border-white/10 focus:border-primary/50 outline-none transition resize-none mb-4 placeholder-muted/50"
              />
              <button
                type="submit"
                disabled={submitting || !comment.trim()}
                className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-all hover:shadow-glow disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Posting...' : 'Post Review'}
              </button>
            </motion.form>
          )}

          {reviews.length === 0 ? (
            <p className="text-muted text-sm">No reviews yet. Be the first to share your thoughts!</p>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <motion.div
                  key={review.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-surface/30 backdrop-blur-sm p-5 rounded-2xl border border-white/5"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-xs font-bold">
                        {review.user?.name?.charAt(0)?.toUpperCase() || 'A'}
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">{review.user?.name || 'Anonymous'}</p>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <span key={s} className={`text-xs ${s <= review.starRating ? 'text-primary' : 'text-muted'}`}>★</span>
                          ))}
                        </div>
                      </div>
                    </div>
                    {(review.user?.id === user?.id) && (
                      <button
                        onClick={() => deleteReview(review.id).then(() => {
                          getReviews(anime.id, reviewPage, 10).then((r) => {
                            setReviews(r.content || [])
                          })
                        })}
                        className="text-xs text-muted hover:text-red-400 transition-colors"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  <p className="text-link/70 text-sm leading-relaxed">{review.comment}</p>
                </motion.div>
              ))}
              {reviewTotalPages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-6">
                  <button
                    onClick={() => setReviewPage(p => Math.max(0, p - 1))}
                    disabled={reviewPage === 0}
                    className="px-4 py-2 rounded-lg text-sm text-muted hover:text-white bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-all"
                  >
                    Previous
                  </button>
                  <span className="text-muted text-sm">{reviewPage + 1} / {reviewTotalPages}</span>
                  <button
                    onClick={() => setReviewPage(p => Math.min(reviewTotalPages - 1, p + 1))}
                    disabled={reviewPage >= reviewTotalPages - 1}
                    className="px-4 py-2 rounded-lg text-sm text-muted hover:text-white bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-all"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
