import { useQuery } from '@tanstack/react-query'
import { getTrending, getSeasonal, filterAnime, searchAnime, getAnimeById, getEpisodeEmbed } from '../api/anime'

export function useTrending(page = 0, size = 25) {
  return useQuery({
    queryKey: ['trending', page, size],
    queryFn: ({ signal }) => getTrending(page, size, signal),
    staleTime: 1000 * 60 * 5,
  })
}

export function useSeasonal(page = 0, size = 25) {
  return useQuery({
    queryKey: ['seasonal', page, size],
    queryFn: ({ signal }) => getSeasonal(page, size, signal),
    staleTime: 1000 * 60 * 5,
  })
}

export function useFilteredAnime(params) {
  const key = JSON.stringify(params)
  return useQuery({
    queryKey: ['filter', key],
    queryFn: ({ signal }) => filterAnime(params, signal),
    staleTime: 1000 * 60 * 5,
  })
}

export function useAnimeById(id) {
  return useQuery({
    queryKey: ['anime', id],
    queryFn: ({ signal }) => getAnimeById(id, signal),
    enabled: !!id,
    staleTime: 1000 * 60 * 2,
  })
}

export function useSearchAnime(query, page = 0, size = 25) {
  return useQuery({
    queryKey: ['search', query, page, size],
    queryFn: ({ signal }) => searchAnime(query, page, size, signal),
    enabled: !!query?.trim(),
    staleTime: 1000 * 60 * 2,
  })
}

export function useEpisodeEmbed(malId, embedUrl) {
  return useQuery({
    queryKey: ['embed', malId, embedUrl],
    queryFn: ({ signal }) => getEpisodeEmbed(malId, embedUrl, signal),
    enabled: !!malId && !!embedUrl,
    staleTime: 1000 * 60 * 10,
    retry: 2,
  })
}
