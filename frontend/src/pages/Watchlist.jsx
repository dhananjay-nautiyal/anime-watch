import { useState, useEffect } from 'react'
import { getWatchlist, removeFromWatchlist, updateWatchlistStatus } from '../api/watchlist'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import ImageWithFallback from '../components/ImageWithFallback'

export default function Watchlist() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const load = () => {
    setLoading(true)
    getWatchlist()
      .then(setEntries)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleStatusChange = async (id, status) => {
    try {
      await updateWatchlistStatus(id, status)
      load()
    } catch {}
  }

  const handleRemove = async (id) => {
    try {
      await removeFromWatchlist(id)
      setMessage('Removed from watchlist')
      load()
    } catch {}
  }

  const statusConfig = {
    WATCHING: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/20', label: 'Watching' },
    COMPLETED: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20', label: 'Completed' },
    PLAN_TO_WATCH: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20', label: 'Plan to Watch' },
  }

  if (loading) {
    return (
      <div className="max-w-[1440px] mx-auto px-4 py-8">
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="skeleton h-24 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-white text-3xl font-bold font-display mb-2">My Watchlist</h1>
        <p className="text-muted text-sm">Track your anime journey</p>
      </div>

      {message && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 mb-6">
          <p className="text-green-400 text-sm">{message}</p>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </div>
          <p className="text-muted mb-4">Your watchlist is empty</p>
          <Link to="/browse" className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-all hover:shadow-glow inline-block">
            Browse Anime
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => {
            const config = statusConfig[entry.status] || statusConfig.PLAN_TO_WATCH
            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-surface/30 backdrop-blur-sm border border-white/5 p-4 rounded-2xl flex items-center gap-4 hover:bg-surface/50 transition-colors"
              >
                <Link to={`/anime/${entry.anime?.malId || entry.anime?.id}`} className="flex-shrink-0 w-16 h-20 rounded-lg overflow-hidden">
                  <ImageWithFallback
                    src={entry.anime?.imageUrl}
                    alt={entry.anime?.title}
                    className=""
                    aspectRatio=""
                    containerClass="w-full h-full"
                  />
                </Link>
                <div className="flex-1 min-w-0">
                  <Link to={`/anime/${entry.anime?.malId || entry.anime?.id}`} className="text-white font-semibold hover:text-primary transition block truncate">
                    {entry.anime?.title}
                  </Link>
                  <span className={`inline-block text-xs px-2.5 py-1 rounded-lg mt-1.5 ${config.bg} ${config.text} ${config.border} border`}>
                    {config.label}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={entry.status}
                    onChange={(e) => handleStatusChange(entry.id, e.target.value)}
                    className="bg-white/5 border border-white/10 text-white px-3 py-2 rounded-xl outline-none text-sm focus:border-primary/50 transition"
                    aria-label="Change status"
                  >
                    <option value="WATCHING">Watching</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="PLAN_TO_WATCH">Plan to Watch</option>
                  </select>
                  <button
                    onClick={() => handleRemove(entry.id)}
                    className="text-muted hover:text-red-400 transition-colors p-2"
                    aria-label="Remove from watchlist"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
