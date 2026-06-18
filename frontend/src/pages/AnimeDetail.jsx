import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getAnimeById, getReviews, addReview } from '../api/anime'
import { addFavorite, removeFavorite, getFavorites } from '../api/favorite'
import { addToWatchlist, getWatchlist, removeFromWatchlist, updateWatchlistStatus } from '../api/watchlist'
import { deleteReview } from '../api/review'
import { useAuth } from '../context/AuthContext'
import Loading from '../components/Loading'

export default function AnimeDetail() {
  const { id: malId } = useParams()
  const { isAuthenticated, user } = useAuth()
  const [anime, setAnime] = useState(null)
  const [loading, setLoading] = useState(true)
  const [reviews, setReviews] = useState([])
  const [reviewPage, setReviewPage] = useState(0)
  const [reviewTotalPages, setReviewTotalPages] = useState(0)

  const [isFavorited, setIsFavorited] = useState(false)
  const [watchlistStatus, setWatchlistStatus] = useState(null)
  const [watchlistId, setWatchlistId] = useState(null)

  const [starRating, setStarRating] = useState(5)
  const [comment, setComment] = useState('')
  const [reviewMsg, setReviewMsg] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setLoading(true)
    getAnimeById(malId)
      .then((res) => setAnime(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [malId])

  useEffect(() => {
    if (!anime?.id) return
    getReviews(anime.id, reviewPage, 10)
      .then((res) => {
        const data = res.data
        setReviews(data?.content || data || [])
        setReviewTotalPages(data?.totalPages || 1)
      })
      .catch(() => {})
  }, [anime?.id, reviewPage])

  useEffect(() => {
    if (isAuthenticated && anime?.id) {
      getFavorites().then((res) => {
        setIsFavorited((res.data || []).some((f) => f.anime?.id === anime.id))
      }).catch(() => {})
      getWatchlist().then((res) => {
        const found = (res.data || []).find((e) => e.anime?.id === anime.id)
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
        const res = await addToWatchlist(anime.id, status)
        setWatchlistStatus(status)
        setWatchlistId(res.data?.id)
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
        setReviews(res.data?.content || res.data || [])
        setReviewPage(0)
      })
    } catch (err) {
      setReviewMsg(err?.message || 'Failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <Loading />
  if (!anime) return <p className="text-muted text-center py-16">Anime not found.</p>

  const imageUrl = anime.imageUrl

  return (
    <div>
      <div className="flex flex-col lg:flex-row gap-8 mb-10">
        <div className="w-full lg:w-72 flex-shrink-0">
          {imageUrl ? (
            <img src={imageUrl} alt={anime.title} className="w-full rounded shadow-lg" />
          ) : (
            <div className="w-full aspect-[3/4] bg-secondary rounded flex items-center justify-center text-muted">No Image</div>
          )}
        </div>
        <div className="flex-1">
          <h1 className="text-textMajor text-2xl font-semibold mb-1">{anime.title}</h1>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="type-badge bg-badgeTv">TV</span>
            {anime.rating && <span className="type-badge bg-primary">{anime.rating}</span>}
            {anime.episodes && <span className="text-sm text-gray">{anime.episodes} eps</span>}
          </div>
          <p className="text-gray leading-relaxed mb-6">{anime.synopsis || 'No synopsis available.'}</p>
          <div className="flex flex-wrap gap-3">
            {anime.trailerUrl && (
              <a href={anime.trailerUrl} target="_blank" rel="noopener noreferrer" className="bg-primary text-white px-5 py-2 rounded text-sm font-medium hover:opacity-90 transition">
                Watch Trailer
              </a>
            )}
            {anime.affiliateUrl && (
              <a href={anime.affiliateUrl} target="_blank" rel="noopener noreferrer" className="border border-primary text-primary px-5 py-2 rounded text-sm font-medium hover:bg-primary hover:text-white transition">
                Visit Site
              </a>
            )}
          </div>
          {isAuthenticated && (
            <div className="flex flex-wrap gap-2 mt-5">
              <button onClick={handleFavorite} className={`px-4 py-2 rounded text-sm font-medium transition ${isFavorited ? 'bg-primary text-white' : 'bg-secondary text-link hover:bg-secondary1'}`}>
                {isFavorited ? '♥ Remove Favorite' : '♡ Add to Favorites'}
              </button>
              {['WATCHING', 'COMPLETED', 'PLAN_TO_WATCH'].map((s) => (
                <button key={s} onClick={() => handleWatchlist(s)} className={`px-4 py-2 rounded text-sm font-medium transition ${watchlistStatus === s ? 'bg-primary text-white' : 'bg-secondary text-link hover:bg-secondary1'}`}>
                  {s === 'WATCHING' ? '▶ Watching' : s === 'COMPLETED' ? '✓ Completed' : '⏳ Plan'}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-textMajor uppercase text-xl mb-4">Reviews</h2>
        {isAuthenticated && (
          <form onSubmit={handleReview} className="bg-card p-4 rounded mb-6">
            {reviewMsg && <p className={`text-sm mb-3 ${reviewMsg.includes('Failed') || reviewMsg.includes('already') ? 'text-primary' : 'text-badgeMovie'}`}>{reviewMsg}</p>}
            <div className="flex items-center gap-1 mb-3">
              <span className="text-gray text-sm mr-2">Rating:</span>
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} type="button" onClick={() => setStarRating(s)} className={`text-xl ${s <= starRating ? 'text-primary' : 'text-muted'}`}>★</button>
              ))}
            </div>
            <textarea placeholder="Write your review..." value={comment} onChange={(e) => setComment(e.target.value)} rows={3} className="w-full bg-body text-link px-4 py-2 rounded border border-dark focus:border-primary outline-none transition resize-none mb-3" />
            <button type="submit" disabled={submitting || !comment.trim()} className="bg-primary text-white px-6 py-2 rounded text-sm font-medium hover:opacity-90 transition disabled:opacity-50">
              {submitting ? 'Posting...' : 'Post Review'}
            </button>
          </form>
        )}
        {reviews.length === 0 ? (
          <p className="text-muted">No reviews yet.</p>
        ) : (
          <div className="space-y-3">
            {reviews.map((review) => (
              <div key={review.id} className="bg-card p-4 rounded">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-textMajor text-sm font-medium">{review.user?.name || 'Anonymous'}</span>
                    <span className="text-primary text-sm">{'★'.repeat(review.starRating)}{'☆'.repeat(5 - review.starRating)}</span>
                  </div>
                    {(review.user?.id === user?.id) && (
                    <button onClick={() => deleteReview(review.id).then(() => {
                      getReviews(anime.id, reviewPage, 10).then((r) => {
                        setReviews(r.data?.content || r.data || [])
                      })
                    })} className="text-primary text-xs hover:underline">Delete</button>
                  )}
                </div>
                <p className="text-gray text-sm">{review.comment}</p>
              </div>
            ))}
            {reviewTotalPages > 1 && (
              <div className="flex justify-center items-center gap-3 mt-4">
                <button onClick={() => setReviewPage(p => Math.max(0, p - 1))} disabled={reviewPage === 0} className="bg-secondary text-link px-4 py-1.5 rounded text-sm disabled:opacity-30">Prev</button>
                <span className="text-muted text-sm">{reviewPage + 1} / {reviewTotalPages}</span>
                <button onClick={() => setReviewPage(p => Math.min(reviewTotalPages - 1, p + 1))} disabled={reviewPage >= reviewTotalPages - 1} className="bg-secondary text-link px-4 py-1.5 rounded text-sm disabled:opacity-30">Next</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
