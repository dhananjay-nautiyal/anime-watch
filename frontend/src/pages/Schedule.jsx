import { useState, useEffect } from 'react'
import { getTrending } from '../api/anime'
import AnimeCard from '../components/AnimeCard'
import { CardSkeleton } from '../components/Skeleton'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function Schedule() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeDay, setActiveDay] = useState(DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1])

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller

    setLoading(true)
    getTrending(0, 50, signal)
      .then((res) => {
        if (signal.aborted) return
        setItems(res.data?.content || res.data || [])
      })
      .catch(() => {})
      .finally(() => { if (!signal.aborted) setLoading(false) })

    return () => controller.abort()
  }, [])

  const filtered = items.filter((_, i) => i % 7 === DAYS.indexOf(activeDay) % 7)

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-white text-3xl font-bold font-display mb-2">Schedule</h1>
      <p className="text-muted text-sm mb-8">Weekly anime broadcast schedule</p>

      <div className="flex flex-wrap gap-2 mb-8">
        {DAYS.map(day => (
          <button
            key={day}
            onClick={() => setActiveDay(day)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeDay === day
                ? 'bg-primary text-white shadow-glow'
                : 'bg-white/5 text-muted hover:text-white hover:bg-white/10'
            }`}
          >
            {day}
          </button>
        ))}
      </div>

      {loading ? (
        <CardSkeleton count={8} />
      ) : filtered.length === 0 ? (
        <p className="text-muted text-center py-16">No anime scheduled for {activeDay}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filtered.map((anime, i) => (
            <AnimeCard key={`${anime.malId || anime.id}-${i}`} anime={anime} index={i} />
          ))}
        </div>
      )}
    </div>
  )
}
