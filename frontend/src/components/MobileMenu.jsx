import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'

export default function MobileMenu({ menuOpen, navLinks, genres, isAuthenticated, onLogout, onClose }) {
  return (
    <AnimatePresence>
      {menuOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="relative z-50 lg:hidden border-t border-white/[0.04] bg-body/95 backdrop-blur-xl"
          >
            <div className="px-4 py-4 space-y-3 max-h-[80vh] overflow-y-auto">
              {navLinks.map(l => (
                !l.dropdown ? (
                  <Link key={l.label} to={l.to} onClick={onClose} className="block text-sm text-[#D1D5DB] hover:text-white py-1.5">{l.label}</Link>
                ) : (
                  <div key={l.label}>
                    <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wider mb-2 px-1 mt-3 font-semibold">{l.label}</p>
                    <div className="grid grid-cols-2 gap-1">
                      {genres.map(g => (
                        <Link key={g.label} to={g.path} onClick={onClose} className="block text-sm text-[#9CA3AF] hover:text-white px-1 py-1.5">
                          {g.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                )
              ))}
              <div className="border-t border-white/[0.04] pt-3">
                {isAuthenticated ? (
                  <>
                    <Link to="/watchlist" onClick={onClose} className="block text-sm text-[#D1D5DB] hover:text-white">Watchlist</Link>
                    <Link to="/favorites" onClick={onClose} className="block text-sm text-[#D1D5DB] hover:text-white">Favorites</Link>
                    <Link to="/profile" onClick={onClose} className="block text-sm text-[#D1D5DB] hover:text-white">Profile</Link>
                    <button onClick={() => { onLogout(); onClose() }} className="text-sm text-[#9CA3AF] hover:text-primary mt-2">Sign Out</button>
                  </>
                ) : (
                  <Link to="/login" onClick={onClose} className="text-sm text-primary">Sign In</Link>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
