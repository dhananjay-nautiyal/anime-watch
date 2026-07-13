import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import ImageWithFallback from './ImageWithFallback'

export default function SearchOverlay({
  open, query, setQuery, suggestions, suggestLoading, showSuggestions,
  recentSearches, onClearRecent, onSearch, onResultClick,
  inputRef, onClose, popularSearches,
}) {
  const navigate = useNavigate()
  const suggestRef = useRef(null)
  const searchOverlayRef = useRef(null)

  const handleFormSubmit = (e) => {
    e.preventDefault()
    if (query.trim()) {
      onSearch(query.trim())
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={searchOverlayRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[60] flex flex-col"
        >
          <div className="bg-body/98 backdrop-blur-2xl flex-1 flex flex-col">
            <div className="max-w-4xl mx-auto w-full px-4 pt-20 pb-4">
              <form onSubmit={handleFormSubmit} ref={suggestRef}>
                <div className="relative group">
                  <svg className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-[#9CA3AF] group-focus-within:text-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Search anime, genres, years..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl py-5 pl-14 pr-14 text-xl text-white placeholder-[#9CA3AF]/40 outline-none focus:border-primary/50 focus:bg-white/[0.06] transition-all duration-300"
                    aria-label="Search anime"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => { setQuery('') }}
                      className="absolute right-5 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-white p-1 rounded-lg hover:bg-white/5 transition-all"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                  {suggestLoading && (
                    <div className="absolute right-14 top-1/2 -translate-y-1/2">
                      <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    </div>
                  )}
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 hidden sm:block">
                    <kbd className="px-2 py-1 text-[10px] font-medium text-[#9CA3AF] bg-white/[0.04] rounded border border-white/[0.08]">ESC</kbd>
                  </div>
                </div>
              </form>
            </div>

            <div className="flex-1 overflow-y-auto max-w-4xl mx-auto w-full px-4 pb-8">
              {showSuggestions && suggestions.length > 0 ? (
                <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/[0.06]">
                    <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wider font-semibold">Suggestions</p>
                  </div>
                  {suggestions.map((anime, i) => (
                    <motion.button
                      key={anime.malId || anime.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      type="button"
                      onClick={() => onResultClick(anime)}
                      className="w-full flex items-center gap-4 px-4 py-3 hover:bg-white/[0.03] transition-colors text-left group/item"
                    >
                      <div className="w-12 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-white/[0.04]">
                        <ImageWithFallback src={anime.imageUrl || anime.images?.jpg?.image_url} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-white font-medium truncate group-hover/item:text-primary transition-colors">{anime.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-[#9CA3AF]">{anime.type || 'TV'}</span>
                          <span className="text-[10px] text-[#9CA3AF]">•</span>
                          <span className="text-[10px] text-[#9CA3AF]">{anime.episodes ? `${anime.episodes} eps` : '?'}</span>
                          {anime.score && (
                            <>
                              <span className="text-[10px] text-[#9CA3AF]">•</span>
                              <span className="text-[10px] text-yellow-400 flex items-center gap-0.5">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                                {anime.score}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <svg className="w-5 h-5 text-[#9CA3AF] opacity-0 group-hover/item:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </motion.button>
                  ))}
                  <button
                    type="button"
                    onClick={() => onSearch(query.trim())}
                    className="w-full text-center text-sm text-primary py-3.5 hover:bg-white/[0.03] transition-colors border-t border-white/[0.06] font-medium"
                  >
                    View all results for &quot;{query}&quot; →
                  </button>
                </div>
              ) : !query.trim() ? (
                <div className="grid md:grid-cols-2 gap-8 mt-4">
                  {recentSearches.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs text-[#9CA3AF] uppercase tracking-wider font-semibold">Recent Searches</h3>
                        <button onClick={onClearRecent} className="text-[10px] text-[#9CA3AF] hover:text-white transition-colors">Clear</button>
                      </div>
                      <div className="space-y-1">
                        {recentSearches.map((q, i) => (
                          <button
                            key={i}
                            onClick={() => { setQuery(q) }}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.04] text-left text-sm text-[#D1D5DB] hover:text-white transition-all"
                          >
                            <svg className="w-4 h-4 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <h3 className="text-xs text-[#9CA3AF] uppercase tracking-wider font-semibold mb-3">Popular Searches</h3>
                    <div className="flex flex-wrap gap-2">
                      {popularSearches.map(q => (
                        <button
                          key={q}
                          onClick={() => { navigate(`/browse?q=${encodeURIComponent(q)}`); onClose() }}
                          className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-sm text-[#D1D5DB] hover:text-white transition-all border border-white/[0.06]"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <button
            onClick={onClose}
            className="absolute top-6 right-6 text-[#9CA3AF] hover:text-white p-2 rounded-full hover:bg-white/[0.04] transition-all"
            aria-label="Close search"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
