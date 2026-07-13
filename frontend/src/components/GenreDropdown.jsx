import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'

export default function GenreDropdown({ genres, genresOpen, setGenresOpen, genresRef }) {
  return (
    <div ref={genresRef} className="relative">
      <button
        onClick={() => setGenresOpen(!genresOpen)}
        className={`flex items-center gap-1 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
          genresOpen ? 'text-white' : 'text-[#9CA3AF] hover:text-white'
        }`}
      >
        Genres
        <svg className={`w-3 h-3 transition-transform duration-200 ${genresOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <AnimatePresence>
        {genresOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 mt-2 w-52 bg-[#141827]/95 backdrop-blur-xl border border-white/[0.06] rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="py-2 max-h-[320px] overflow-y-auto">
              {genres.map(g => (
                <Link
                  key={g.label}
                  to={g.path}
                  onClick={() => setGenresOpen(false)}
                  className="block px-4 py-2.5 text-sm text-[#9CA3AF] hover:text-white hover:bg-white/[0.04] transition-colors"
                >
                  {g.label}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
