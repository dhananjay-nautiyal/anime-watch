import { motion } from 'framer-motion'

function statusColor(status) {
  switch (status) {
    case 'online': return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
    case 'offline': return 'border-rose-500/30 bg-rose-500/10 text-rose-400'
    case 'error': return 'border-amber-500/30 bg-amber-500/10 text-amber-400'
    default: return 'border-white/10 bg-white/[0.04] text-white/50'
  }
}

function latencyColor(ms) {
  if (ms == null) return ''
  if (ms < 1000) return 'text-emerald-400'
  if (ms < 3000) return 'text-amber-400'
  return 'text-rose-400'
}

export default function ServerGrid({ servers = [], selectedUrl, onSelect, loading, failoverActive }) {
  if (servers.length === 0 && !loading) return null

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {servers.map((server, i) => {
        const isActive = selectedUrl === server.url || selectedUrl === server.proxyUrl
        const status = server.status || 'unknown'
        const latency = server.latencyMs

        return (
          <motion.button
            key={`${server.label}-${i}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => !loading && onSelect(server)}
            disabled={loading || status === 'offline'}
            className={`relative px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-200 border flex flex-col items-start gap-1 ${
              isActive
                ? 'bg-primary/15 border-primary/40 text-primary shadow-lg shadow-primary/10 ring-1 ring-primary/30'
                : status === 'offline'
                  ? 'bg-rose-500/5 border-rose-500/20 text-rose-400/50 cursor-not-allowed'
                  : `hover:bg-white/[0.06] hover:border-white/20 text-white/70 hover:text-white ${statusColor(status)}`
            } ${loading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
            aria-label={`Server: ${server.label}`}
          >
            <span className="flex items-center gap-2 w-full">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${status === 'online' ? 'bg-emerald-500 shadow-emerald-500/50 shadow-sm' : status === 'offline' ? 'bg-rose-500' : 'bg-white/30'}`} />
              <span className="flex-1 text-left font-semibold text-sm">{server.label}</span>
              {isActive && <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-bold">Active</span>}
              {failoverActive && !isActive && status === 'online' && (
                <span className="text-[9px] bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded font-medium">Failover</span>
              )}
            </span>
            <span className="flex items-center gap-2 text-[10px] text-white/40 ml-3.5">
              {server.qualities && server.qualities.length > 0 && (
                <span>{server.qualities.join(' | ')}</span>
              )}
              {latency != null && (
                <span className={latencyColor(latency)}>
                  {latency < 1000 ? `${latency}ms` : `${(latency / 1000).toFixed(1)}s`}
                </span>
              )}
              {status === 'offline' && <span className="text-rose-400">Offline</span>}
            </span>
          </motion.button>
        )
      })}
    </div>
  )
}
