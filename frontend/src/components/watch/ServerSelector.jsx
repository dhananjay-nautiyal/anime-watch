import { useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'

function groupServers(servers) {
  const primary = []
  const backup = []
  servers.forEach((s, i) => {
    if (s.isBackup || i >= 4) backup.push(s)
    else primary.push(s)
  })
  return { primary, backup }
}

function ServerButton({ server, index, isActive, onClick, loading }) {
  return (
    <button
      onClick={() => !loading && onClick(server)}
      disabled={loading}
      className={`relative px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 border ${
        isActive
          ? 'bg-primary/15 border-primary/40 text-primary shadow-lg shadow-primary/10'
          : 'bg-white/[0.04] border-white/10 text-white/70 hover:text-white hover:bg-white/[0.08] hover:border-white/20'
      } ${loading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
      aria-label={`Server ${index + 1}: ${server.label || server.url?.slice(0, 40)}`}
    >
      {loading ? (
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          Loading...
        </span>
      ) : (
        <span className="flex items-center gap-1.5">
          {isActive && (
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          )}
          {server.label || `Server ${index + 1}`}
        </span>
      )}
    </button>
  )
}

export default function ServerSelector({ servers = [], currentServer, onSwitch, loading = false, currentProvider }) {
  const { primary, backup } = useMemo(() => groupServers(servers), [servers])

  const isCurrent = useCallback((s) => {
    if (!currentServer) return false
    return s.url === currentServer.url || s.label === currentServer.label
  }, [currentServer])

  if (servers.length === 0 && !loading) return null

  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white text-sm font-bold flex items-center gap-2">
          <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
          </svg>
          Servers
        </h3>
        {currentProvider && (
          <span className="text-[10px] text-muted bg-white/5 px-2 py-0.5 rounded">{currentProvider}</span>
        )}
      </div>

      {servers.length === 0 && loading && (
        <div className="flex items-center gap-2 py-3">
          <div className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <span className="text-muted text-xs">Discovering servers...</span>
        </div>
      )}

      {primary.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] text-muted/50 font-semibold uppercase tracking-wider mb-2">Primary</p>
          <div className="flex flex-wrap gap-2">
            {primary.map((server, i) => (
              <ServerButton
                key={i}
                server={server}
                index={i}
                isActive={isCurrent(server)}
                onClick={onSwitch}
                loading={loading}
              />
            ))}
          </div>
        </div>
      )}

      {backup.length > 0 && (
        <div>
          <p className="text-[10px] text-muted/50 font-semibold uppercase tracking-wider mb-2">Backup</p>
          <div className="flex flex-wrap gap-2">
            {backup.map((server, i) => (
              <ServerButton
                key={i + primary.length}
                server={server}
                index={i + primary.length}
                isActive={isCurrent(server)}
                onClick={onSwitch}
                loading={loading}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
