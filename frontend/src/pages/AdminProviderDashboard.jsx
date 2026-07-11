import { useState, useEffect, useCallback } from 'react'
import { getProviderHealth, getProviderMetrics, getProviderCache } from '../api/admin'

function fmtMs(ms) {
  if (ms == null) return '-'
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function fmtUptime(ms) {
  if (!ms) return '-'
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  const parts = []
  if (d > 0) parts.push(`${d}d`)
  if (h % 24 > 0) parts.push(`${h % 24}h`)
  if (m % 60 > 0) parts.push(`${m % 60}m`)
  if (s % 60 > 0) parts.push(`${s % 60}s`)
  return parts.join(' ') || '0s'
}

function StatCard({ label, value, sub, color }) {
  return (
    <div className="bg-card border border-dimBlue rounded-xl p-4 flex flex-col gap-1">
      <p className="text-muted text-[11px] font-medium uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold ${color || 'text-white'}`}>{value}</p>
      {sub && <p className="text-muted/60 text-[10px]">{sub}</p>}
    </div>
  )
}

function ProviderRow({ name, health, stats }) {
  const isHealthy = health === true || health === 'true'
  const successRate = stats?.successRate != null ? (stats.successRate * 100).toFixed(1) : '-'
  const avgLatency = stats?.avgLatencyMs != null ? fmtMs(stats.avgLatencyMs) : '-'
  const totalReqs = stats?.totalRequests ?? '-'

  return (
    <div className="flex items-center gap-4 bg-card border border-dimBlue rounded-xl px-4 py-3 text-sm">
      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isHealthy ? 'bg-emerald-500 shadow-emerald-500/50 shadow-sm' : 'bg-rose-500 shadow-rose-500/50 shadow-sm'}`} />
      <span className="text-white font-semibold w-28 flex-shrink-0">{name}</span>
      <span className={`text-xs font-medium w-16 ${isHealthy ? 'text-emerald-400' : 'text-rose-400'}`}>{isHealthy ? 'Healthy' : 'Down'}</span>
      <span className="text-muted text-xs w-20 text-right">{totalReqs} reqs</span>
      <span className="text-muted text-xs w-20 text-right">{successRate}%</span>
      <span className="text-muted text-xs w-24 text-right">{avgLatency}</span>
      <div className="flex-1" />
      <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${isHealthy ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${isHealthy ? 100 : 15}%` }} />
      </div>
    </div>
  )
}

function TelemetryTable({ telemetry, providers }) {
  if (!telemetry) return null
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted/50 uppercase tracking-wider">
            <th className="text-left py-2 pr-4">Provider</th>
            <th className="text-right py-2 px-4">Switches</th>
            <th className="text-right py-2 px-4">Requests</th>
            <th className="text-right py-2 px-4">Failures</th>
            <th className="text-right py-2 px-4">Avg Latency</th>
            <th className="text-right py-2 px-4">Health Score</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(providers || {}).map(([name, p]) => {
            const pt = telemetry.providerStats?.[name] || {}
            const avgLat = pt.avgLatencyMs ? fmtMs(pt.avgLatencyMs) : '-'
            const healthScore = p.healthScore != null ? (p.healthScore * 100).toFixed(0) : '-'
            return (
              <tr key={name} className="border-t border-white/5 hover:bg-white/[0.02]">
                <td className="py-2 pr-4 text-white font-medium">{name}</td>
                <td className="text-right py-2 px-4 text-muted">{pt.switches ?? 0}</td>
                <td className="text-right py-2 px-4 text-muted">{pt.requests ?? 0}</td>
                <td className="text-right py-2 px-4 text-rose-400">{pt.failures ?? 0}</td>
                <td className="text-right py-2 px-4 text-muted">{avgLat}</td>
                <td className="text-right py-2 px-4">{healthScore !== '-' ? <span className={`font-medium ${Number(healthScore) > 70 ? 'text-emerald-400' : Number(healthScore) > 30 ? 'text-amber-400' : 'text-rose-400'}`}>{healthScore}%</span> : '-'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function AdminProviderDashboard() {
  const [health, setHealth] = useState([])
  const [metrics, setMetrics] = useState(null)
  const [cache, setCache] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('overview')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [h, m, c] = await Promise.all([
        getProviderHealth(),
        getProviderMetrics(),
        getProviderCache(),
      ])
      setHealth(h.data?.data || [])
      setMetrics(m.data?.data || null)
      setCache(c.data?.data || null)
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to load provider data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const telemetry = metrics?.telemetry
  const priorities = metrics?.priorities
  const providerDetails = metrics?.providers || {}

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-white text-xl font-bold">Provider Dashboard</h1>
        <button onClick={load} disabled={loading} className="bg-primary/20 hover:bg-primary/30 text-primary text-xs font-medium px-4 py-2 rounded-lg transition-all disabled:opacity-50">
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/[0.03] border border-white/5 rounded-xl p-1">
        {['overview', 'telemetry', 'cache'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2 text-xs font-medium rounded-lg capitalize transition-all ${tab === t ? 'bg-primary/15 text-primary shadow-sm' : 'text-muted hover:text-white'}`}>
            {t === 'cache' ? 'Cache Stats' : t}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex flex-col items-center gap-4 py-16">
          <div className="w-8 h-8 border-[3px] border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-muted text-xs">Loading provider data...</p>
        </div>
      )}

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 text-rose-400 text-sm">
          {error}
          <button onClick={load} className="ml-3 underline text-rose-300">Retry</button>
        </div>
      )}

      {/* Overview Tab */}
      {!loading && !error && tab === 'overview' && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Providers" value={health.length} sub={health.filter(h => h.healthy === true || h.healthy === 'true').length + ' healthy'} color="text-emerald-400" />
            <StatCard label="Cache Entries" value={cache?.total ?? 0} sub={cache?.streamable != null ? `${cache.streamable} streamable` : undefined} color="text-primary" />
            <StatCard label="Validation Failures" value={telemetry?.validationFailures ?? 0} sub={`${telemetry?.validationCount ?? 0} in history`} color="text-amber-400" />
            <StatCard label="Uptime" value={fmtUptime(telemetry?.uptimeMs)} sub={telemetry?.startupTime ? `Since ${new Date(telemetry.startupTime).toLocaleDateString()}` : undefined} color="text-white" />
          </div>

          {/* Provider rows */}
          <div>
            <h2 className="text-white text-sm font-bold mb-3">Provider Health</h2>
            <div className="space-y-2">
              {health.length === 0 && <p className="text-muted text-xs">No providers registered</p>}
              {health.map(p => (
                <ProviderRow key={p.name} name={p.name} health={p.healthy} stats={p.stats} />
              ))}
            </div>
          </div>

          {/* Priority order */}
          {priorities && (
            <div className="bg-card border border-dimBlue rounded-xl p-4">
              <h2 className="text-white text-sm font-bold mb-2">Provider Priority</h2>
              <div className="flex items-center gap-2 flex-wrap">
                {(priorities.order || []).map((p, i) => (
                  <span key={p} className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-lg text-xs text-white">
                    <span className="text-muted/50">{i + 1}.</span>
                    {p}
                    {priorities.scores?.[p] != null && <span className="text-muted/50 ml-1">({(priorities.scores[p] * 100).toFixed(0)}%)</span>}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Telemetry Tab */}
      {!loading && !error && tab === 'telemetry' && telemetry && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Provider Switches" value={telemetry.providerSwitches ?? 0} />
            <StatCard label="Recovery Rate" value={telemetry.recoveryRate != null ? `${telemetry.recoveryRate.toFixed(1)}%` : '-'} sub={`${telemetry.recoverySuccesses ?? 0}/${telemetry.recoveryAttempts ?? 0}`} color="text-emerald-400" />
            <StatCard label="Avg Buffering" value={telemetry.avgBufferingMs != null ? fmtMs(telemetry.avgBufferingMs) : '-'} sub={`${telemetry.bufferingCount ?? 0} events`} color="text-amber-400" />
            <StatCard label="Validation Failures" value={telemetry.validationFailures ?? 0} sub={`${telemetry.validationCount ?? 0} events`} color="text-rose-400" />
          </div>

          <div className="bg-card border border-dimBlue rounded-xl p-4">
            <h2 className="text-white text-sm font-bold mb-4">Per-Provider Telemetry</h2>
            <TelemetryTable telemetry={telemetry} providers={providerDetails} />
          </div>
        </div>
      )}

      {/* Cache Tab */}
      {!loading && !error && tab === 'cache' && cache && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Total Entries" value={cache.total ?? 0} color="text-white" />
            <StatCard label="Streamable" value={cache.streamable ?? 0} color="text-emerald-400" />
            <StatCard label="Validated" value={cache.validated ?? 0} color="text-primary" />
            <StatCard label="Expired" value={cache.expired ?? 0} color="text-amber-400" />
          </div>

          <div className="bg-card border border-dimBlue rounded-xl p-4">
            <h2 className="text-white text-sm font-bold mb-4">By Provider</h2>
            {cache.byProvider && Object.keys(cache.byProvider).length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted/50 uppercase tracking-wider">
                      <th className="text-left py-2 pr-4">Provider</th>
                      <th className="text-right py-2 px-4">Entries</th>
                      <th className="py-2 pl-4" />
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(cache.byProvider).map(([name, count]) => {
                      const total = cache.total || 1
                      const pct = (count / total) * 100
                      return (
                        <tr key={name} className="border-t border-white/5 hover:bg-white/[0.02]">
                          <td className="py-2 pr-4 text-white font-medium">{name}</td>
                          <td className="text-right py-2 px-4 text-muted">{count}</td>
                          <td className="py-2 pl-4">
                            <div className="w-32 h-1.5 bg-white/10 rounded-full overflow-hidden ml-auto">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-muted text-xs">No provider data in cache</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
