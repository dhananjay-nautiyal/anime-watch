import client from './client'

export const getResume = (malId, signal) =>
  client.get(`/api/anime/${malId}/resume`, { signal })
    .then(res => res.data?.data ?? null)
    .catch(() => null)

export const saveResume = (malId, { episodeNumber, progressSeconds, durationSeconds, animeTitle, animeImage }) =>
  client.post(`/api/anime/${malId}/resume`, {
    episodeNumber, progressSeconds, durationSeconds, animeTitle, animeImage,
  }).then(res => res.data?.data ?? null)
    .catch(() => null)

export const getContinueWatching = (signal) =>
  client.get('/api/anime/continue-watching', { signal })
    .then(res => res.data?.data ?? [])
    .catch(() => [])
