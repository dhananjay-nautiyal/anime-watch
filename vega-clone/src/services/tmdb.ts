import { QueryClient } from '@tanstack/react-query'

export const TMDB_API_KEY = 'f43ec82a5f24fe6190891894b7436c7a'
export const TMDB_BASE = 'https://api.themoviedb.org/3'
export const TMDB_IMAGE = 'https://image.tmdb.org/t/p'
export const PROXY_API_URL = 'https://meta.1proxy.workers.dev'

export interface MediaItem {
  id: number
  title?: string
  name?: string
  poster_path?: string | null
  backdrop_path?: string | null
  overview?: string
  release_date?: string
  first_air_date?: string
  vote_average?: number
  media_type?: 'movie' | 'tv' | string
}

function titleOf(m: MediaItem) {
  return m.title ?? m.name ?? 'Untitled'
}

export { titleOf }

async function tmdb(path: string, params: Record<string, string> = {}) {
  const url = new URL(`${TMDB_BASE}${path}`)
  url.searchParams.set('api_key', TMDB_API_KEY)
  url.searchParams.set('language', 'en-US')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`TMDB ${res.status}`)
  return res.json()
}

export async function getTrendingMovies() {
  const data = await tmdb('/trending/movie/week')
  return (data.results ?? []).map((m: MediaItem) => ({ ...m, media_type: 'movie' })) as MediaItem[]
}

export async function getTrendingTv() {
  const data = await tmdb('/trending/tv/week')
  return (data.results ?? []).map((m: MediaItem) => ({ ...m, media_type: 'tv' })) as MediaItem[]
}

export async function getPopularMovies() {
  const data = await tmdb('/movie/popular')
  return (data.results ?? []).map((m: MediaItem) => ({ ...m, media_type: 'movie' })) as MediaItem[]
}

export async function getTopRated() {
  const data = await tmdb('/movie/top_rated')
  return (data.results ?? []).map((m: MediaItem) => ({ ...m, media_type: 'movie' })) as MediaItem[]
}

export async function searchMedia(query: string) {
  const data = await tmdb('/search/multi', { query })
  return (data.results ?? []).filter((m: MediaItem) => m.media_type === 'movie' || m.media_type === 'tv') as MediaItem[]
}

export async function getMovieDetails(id: number) {
  return tmdb(`/movie/${id}`, { append_to_response: 'videos,credits' })
}

export async function getTvDetails(id: number) {
  return tmdb(`/tv/${id}`, { append_to_response: 'videos,credits' })
}

export function posterUrl(path?: string | null, size: string = 'w500') {
  if (!path) return undefined
  return `${TMDB_IMAGE}/${size}${path}`
}

export function backdropUrl(path?: string | null, size: string = 'w1280') {
  if (!path) return undefined
  return `${TMDB_IMAGE}/${size}${path}`
}

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 5, retry: 2 } },
})