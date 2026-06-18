import { useState, useEffect } from 'react'
import { getWatchlist, removeFromWatchlist, updateWatchlistStatus } from '../api/watchlist'
import { Link } from 'react-router-dom'
import Loading from '../components/Loading'

export default function Watchlist() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const load = () => {
    setLoading(true)
    getWatchlist()
      .then((res) => setEntries(res.data || []))
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

  const statusColors = {
    WATCHING: 'bg-green-500/20 text-green-400',
    COMPLETED: 'bg-blue-500/20 text-blue-400',
    PLAN_TO_WATCH: 'bg-yellow-500/20 text-yellow-400',
  }

  if (loading) return <Loading />

  return (
    <div>
      <h1 className="text-white text-3xl font-semibold mb-6">My Watchlist</h1>
      {message && <div className="text-green-400 text-sm mb-4">{message}</div>}
      {entries.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-dimWhite mb-4">Your watchlist is empty.</p>
          <Link to="/trending" className="bg-secondary text-white px-6 py-2.5 rounded-lg inline-block hover:opacity-90 transition">Browse Anime</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <div key={entry.id} className="bg-card p-4 rounded-xl flex items-center gap-4">
              <Link to={`/anime/${entry.anime?.malId}`} className="flex-shrink-0 w-16 h-20 rounded overflow-hidden">
                <img src={entry.anime?.imageUrl || '/placeholder.jpg'} alt={entry.anime?.title} className="w-full h-full object-cover" />
              </Link>
              <div className="flex-1 min-w-0">
                <Link to={`/anime/${entry.anime?.malId}`} className="text-white font-semibold hover:text-secondary transition block truncate">
                  {entry.anime?.title}
                </Link>
                <span className={`inline-block text-xs px-2 py-0.5 rounded mt-1 ${statusColors[entry.status] || 'bg-dimBlue text-dimWhite'}`}>
                  {entry.status?.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={entry.status}
                  onChange={(e) => handleStatusChange(entry.id, e.target.value)}
                  className="bg-primary text-white px-2 py-1.5 rounded border border-dimBlue outline-none text-sm"
                >
                  <option value="WATCHING">Watching</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="PLAN_TO_WATCH">Plan to Watch</option>
                </select>
                <button onClick={() => handleRemove(entry.id)} className="text-red-400 hover:text-red-300 transition text-sm">
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
