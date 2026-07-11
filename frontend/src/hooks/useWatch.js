import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getAnimeById, getEpisodes, syncEpisodes, getEpisodeEmbed, getAnimeState, getTrending } from '../api/anime'
import { getResume, saveResume } from '../api/watchHistory'
import { extractErrorMessage } from '../api/client'

const PROXY_BASE = '/api/stream/proxy'

export function wrapProxy(url, referer) {
  if (!url || url.startsWith(PROXY_BASE)) return url
  return `${PROXY_BASE}?url=${encodeURIComponent(url)}&referer=${encodeURIComponent(referer || 'https://anineko.to/')}`
}

export function useAnime(malId) {
  return useQuery({
    queryKey: ['anime', malId],
    queryFn: ({ signal }) => getAnimeById(malId, signal),
    enabled: !!malId,
    staleTime: 300000,
    retry: 2,
  })
}

export function useEpisodes(malId) {
  return useQuery({
    queryKey: ['episodes', malId],
    queryFn: ({ signal }) => getEpisodes(malId, signal),
    enabled: !!malId,
    staleTime: 300000,
    retry: 1,
  })
}

export function useSync(malId, episodes, isLoading) {
  const qc = useQueryClient()
  const attempted = useRef(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState(null)

  const doSync = useCallback(async () => {
    if (attempted.current) return
    attempted.current = true
    setSyncing(true)
    setError(null)
    try {
      const data = await syncEpisodes(malId)
      if (data && data.length > 0) {
        qc.setQueryData(['episodes', malId], data)
      } else {
        setError('No episodes available from streaming providers.')
      }
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setSyncing(false)
    }
  }, [malId, qc])

  useEffect(() => {
    if (episodes?.length === 0 && !isLoading && !syncing && !attempted.current) {
      doSync()
    }
  }, [episodes, isLoading, syncing, doSync])

  const retry = useCallback(() => {
    attempted.current = false
    doSync()
  }, [doSync])

  return { syncing, error, retry }
}

export function useEmbed(malId, episodes, currentEp) {
  const [embedUrl, setEmbedUrl] = useState('')
  const [embedType, setEmbedType] = useState('hls')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [servers, setServers] = useState([])
  const mounted = useRef(true)

  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  const load = useCallback(async () => {
    if (!episodes || episodes.length === 0) return
    const ep = episodes.find(e => e.episodeNumber === currentEp)
    if (!ep?.embedUrl) { setError('Episode URL not available.'); setLoading(false); return }

    setLoading(true)
    setError(null)
    try {
      const payload = await getEpisodeEmbed(malId, ep.embedUrl)
      if (!mounted.current) return
      if (payload?.embedUrl) {
        const ref = payload.referer || 'https://anineko.to/'
        setEmbedUrl(wrapProxy(payload.embedUrl, ref))
        setEmbedType(payload.type || 'hls')
        setServers((payload.servers || []).map(s => ({ ...s, url: wrapProxy(s.url, ref) })))
      } else {
        setError('Could not retrieve stream source.')
      }
    } catch (err) {
      if (mounted.current) setError(extractErrorMessage(err))
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [episodes, currentEp, malId])

  return { embedUrl, embedType, loading, error, servers, load, setEmbedUrl, setEmbedType }
}

export function useServerSwitch() {
  const [currentServer, setCurrentServer] = useState(null)

  const switchServer = useCallback((server, setEmbedUrl, setEmbedType) => {
    setCurrentServer(server)
    if (setEmbedUrl) setEmbedUrl(server.url)
    if (setEmbedType) setEmbedType(server.url?.includes('.m3u8') ? 'hls' : 'iframe')
  }, [])

  return { currentServer, setCurrentServer, switchServer }
}

export function useEpisodeNavigation(malId, episodes) {
  const navigate = useNavigate()
  const [currentEp, setCurrentEpState] = useState(1)

  const nextEpisode = useMemo(() =>
    episodes?.find(e => e.episodeNumber === currentEp + 1), [episodes, currentEp])

  const setCurrentEp = useCallback((ep) => {
    setCurrentEpState(ep)
    window.history.replaceState(null, '', `/anime/${malId}/ep/${ep}`)
  }, [malId])

  const goNext = useCallback(() => {
    if (nextEpisode) setCurrentEp(nextEpisode.episodeNumber)
  }, [nextEpisode, setCurrentEp])

  const goPrev = useCallback(() => {
    if (currentEp > 1) setCurrentEp(currentEp - 1)
  }, [currentEp, setCurrentEp])

  return { currentEp, setCurrentEp, nextEpisode, goNext, goPrev }
}

export function useAutoNext() {
  const [visible, setVisible] = useState(false)
  const show = useCallback(() => setVisible(true), [])
  const hide = useCallback(() => setVisible(false), [])
  return { visible, show, hide }
}

export function useContinueWatching(malId, anime, currentEp) {
  useEffect(() => {
    if (!anime || !currentEp) return
    try {
      const data = JSON.parse(localStorage.getItem('aw_continue') || '{}')
      data[malId] = {
        animeId: malId, animeTitle: anime.title, animeImage: anime.imageUrl,
        episode: currentEp, timestamp: Date.now(),
      }
      localStorage.setItem('aw_continue', JSON.stringify(data))
    } catch {}
  }, [anime, malId, currentEp])
}

export function useComingSoonRedirect(anime, malId) {
  const navigate = useNavigate()

  useEffect(() => {
    const s = anime?.status?.toUpperCase().replace(/\s+/g, '_') || ''
    if (['COMING_SOON', 'NOT_RELEASED', 'NOT_YET_RELEASED', 'NOT_YET_AIRED'].includes(s)) {
      navigate(`/coming-soon/${malId}`, { replace: true })
      return
    }
    if (!anime) return
    getAnimeState(malId).then(state => {
      if (state?.comingSoon) navigate(`/coming-soon/${malId}`, { replace: true })
    }).catch(() => {})
  }, [anime, malId, navigate])
}
