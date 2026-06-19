import { useState, useEffect } from 'react'
import { getFavorites, removeFavorite } from '../api/favorite'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import ImageWithFallback from '../components/ImageWithFallback'
import { CardSkeleton } from '../components/Skeleton'

export default function Favorites() {
  const [favorites, setFavorites] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const load = () => {
    setLoading(true)
    getFavorites()
      .then(setFavorites)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleRemove = async (animeId) => {
    try {
      await removeFavorite(animeId)
      setMessage('Removed from favorites')
      load()
    } catch {}
  }

  if (loading) return <div className="max-w-[1440px] mx-auto px-4 py-8"><CardSkeleton count={8} /></div>

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-white text-3xl font-bold font-display mb-2">My Favorites</h1>
        <p className="text-muted text-sm">Your collection of favorite anime</p>
      </div>

      {message && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 mb-6">
          <p className="text-green-400 text-sm">{message}</p>
        </div>
      )}

      {favorites.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <p className="text-muted mb-4">No favorites yet</p>
          <Link to="/browse" className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-all hover:shadow-glow inline-block">
            Browse Anime
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {favorites.map((fav) => (
            <motion.div
              key={fav.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="group relative"
            >
              <Link to={`/anime/${fav.anime?.malId || fav.anime?.id}`}>
                <ImageWithFallback
                  src={fav.anime?.imageUrl}
                  alt={fav.anime?.title}
                  className="group-hover:scale-105 transition-transform duration-500"
                />
                <div className="mt-2">
                  <h3 className="text-white font-semibold text-sm line-clamp-2 group-hover:text-primary transition-colors">
                    {fav.anime?.title}
                  </h3>
                </div>
              </Link>
              <button
                onClick={() => handleRemove(fav.anime?.id)}
                className="absolute top-2 right-2 bg-red-500/90 hover:bg-red-500 text-white text-xs px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all shadow-lg backdrop-blur-sm"
              >
                Remove
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
