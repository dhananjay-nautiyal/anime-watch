import { useState, useEffect } from 'react'
import { getFavorites, removeFavorite } from '../api/favorite'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import ImageWithFallback from '../components/ImageWithFallback'
import { CardSkeleton } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import { useToast } from '../context/ToastContext'

export default function Favorites() {
  const [favorites, setFavorites] = useState([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const load = (signal) => {
    setLoading(true)
    getFavorites(signal)
      .then((data) => { if (!signal?.aborted) setFavorites(data) })
      .catch(() => {})
      .finally(() => { if (!signal?.aborted) setLoading(false) })
  }

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [])

  const handleRemove = async (animeId) => {
    try {
      await removeFavorite(animeId)
      toast('Removed from favorites', 'success')
      load()
    } catch {
      toast('Failed to remove from favorites', 'error')
    }
  }

  if (loading) return <div className="max-w-[1440px] mx-auto px-4 py-8"><CardSkeleton count={8} /></div>

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-white text-3xl font-bold font-display mb-2">My Favorites</h1>
        <p className="text-muted text-sm">Your collection of favorite anime</p>
      </div>

      {favorites.length === 0 ? (
        <EmptyState
          icon="heart"
          title="No favorites yet"
          message="Save your favorite anime here by clicking the heart icon on any anime page."
          actionLabel="Browse Anime"
          actionLink="/browse"
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {favorites.map((fav) => (
            <motion.div
              key={fav.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="group relative"
            >
              <Link to={`/anime/${fav.anime?.slug || fav.anime?.malId || fav.anime?.id}`}>
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
