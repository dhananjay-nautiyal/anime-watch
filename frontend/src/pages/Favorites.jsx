import { useState, useEffect } from 'react'
import { getFavorites, removeFavorite } from '../api/favorite'
import { Link } from 'react-router-dom'
import Loading from '../components/Loading'

export default function Favorites() {
  const [favorites, setFavorites] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const load = () => {
    setLoading(true)
    getFavorites()
      .then((res) => setFavorites(res.data || []))
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

  if (loading) return <Loading />

  return (
    <div>
      <h1 className="text-white text-3xl font-semibold mb-6">My Favorites</h1>
      {message && <div className="text-green-400 text-sm mb-4">{message}</div>}
      {favorites.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-dimWhite mb-4">No favorites yet.</p>
          <Link to="/trending" className="bg-secondary text-white px-6 py-2.5 rounded-lg inline-block hover:opacity-90 transition">Browse Anime</Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {favorites.map((fav) => (
            <div key={fav.id} className="bg-card rounded-xl overflow-hidden group relative">
              <Link to={`/anime/${fav.anime?.malId}`}>
                <div className="aspect-[3/4] overflow-hidden">
                  <img src={fav.anime?.imageUrl || '/placeholder.jpg'} alt={fav.anime?.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                </div>
                <div className="p-3">
                  <h3 className="text-white font-semibold text-sm line-clamp-2">{fav.anime?.title}</h3>
                </div>
              </Link>
              <button
                onClick={() => handleRemove(fav.anime?.id)}
                className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
