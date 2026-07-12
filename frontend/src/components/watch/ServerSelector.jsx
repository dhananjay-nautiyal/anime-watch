import { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ServerGrid from './ServerGrid'

const LANG_OPTIONS = ['SUB', 'DUB']

export default function ServerSelector({
  languages = [], currentLanguage, onLanguageChange,
  servers = [], selectedServerUrl, onServerChange,
  loading = false, failoverActive = false, currentProvider,
}) {
  const availableLanguages = useMemo(() => {
    if (languages.length > 0) return languages
    if (servers.length > 0) return [{ language: 'SUB', servers }]
    return []
  }, [languages, servers])

  const hasLang = useMemo(() => {
    const map = {}
    for (const l of availableLanguages) map[l.language] = true
    return map
  }, [availableLanguages])

  const activeLang = currentLanguage || availableLanguages[0]?.language || 'SUB'
  const activeServers = availableLanguages.find(l => l.language === activeLang)?.servers || []

  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-xl overflow-hidden">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
            </svg>
            <h3 className="text-white text-sm font-bold">Servers</h3>
            {currentProvider && (
              <span className="text-[10px] text-muted bg-white/5 px-2 py-0.5 rounded">{currentProvider}</span>
            )}
          </div>
          {failoverActive && (
            <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded font-medium animate-pulse">
              Failover
            </span>
          )}
        </div>

        {/* Language Pills */}
        <div className="flex gap-2 mb-4">
          {LANG_OPTIONS.map((lang) => {
            const available = !!hasLang[lang]
            const active = activeLang === lang
            return (
              <button
                key={lang}
                onClick={() => available && onLanguageChange?.(lang)}
                disabled={!available}
                className={`
                  relative px-5 py-2 text-xs font-bold rounded-full transition-all duration-200
                  ${!available
                    ? 'text-white/15 bg-white/[0.02] border border-white/[0.04] cursor-not-allowed'
                    : active
                      ? 'bg-primary/25 text-primary shadow-lg shadow-primary/10 border border-primary/30 scale-105'
                      : 'text-white/60 bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] hover:text-white hover:border-white/20 hover:scale-105'
                  }
                `}
              >
                {lang}
                {!available && (
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-white/20 rounded-full" />
                )}
              </button>
            )
          })}
        </div>

        {/* Server loading state */}
        {loading && activeServers.length === 0 && (
          <div className="flex items-center gap-2 py-4">
            <div className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <span className="text-muted text-xs">Resolving servers...</span>
          </div>
        )}

        {/* No servers */}
        {!loading && activeServers.length === 0 && (
          <div className="text-center py-6">
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-2">
              <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
            <p className="text-muted text-xs">No working {activeLang} servers found</p>
            {availableLanguages.length > 1 && (
              <p className="text-muted/50 text-[10px] mt-1">Try {availableLanguages.find(l => l.language !== activeLang)?.language} instead</p>
            )}
          </div>
        )}

        {/* Server Grid */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeLang}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            <ServerGrid
              servers={activeServers}
              selectedUrl={selectedServerUrl}
              onSelect={onServerChange}
              loading={loading}
              failoverActive={failoverActive}
            />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}