declare module '@anime/api' {
  import { AxiosInstance, AxiosResponse } from 'axios'

  export interface TokenStore {
    getToken: () => Promise<string | null>
    setToken: (token: string) => Promise<void>
    getRefreshToken: () => Promise<string | null>
    setRefreshToken: (token: string) => Promise<void>
    clearTokens: () => Promise<void>
  }

  export const client: AxiosInstance
  export function configureTokenStorage(store: TokenStore): void
  export function extractErrorMessage(err: any): string
  export function extractErrorCode(err: any): string | null

  export function login(email: string, password: string): Promise<AxiosResponse>
  export function register(name: string, email: string, password: string): Promise<AxiosResponse>
  export function logout(refreshToken: string): Promise<AxiosResponse>
  export function refreshToken(token: string): Promise<AxiosResponse>
  export function forgotPassword(email: string): Promise<AxiosResponse>
  export function resetPassword(token: string, password: string): Promise<AxiosResponse>
  export function getProfile(signal?: AbortSignal): Promise<AxiosResponse>
  export function updateProfile(data: any): Promise<AxiosResponse>

  export function getTrending(page?: number, size?: number, signal?: AbortSignal): Promise<any>
  export function searchAnime(q: string, page?: number, size?: number, signal?: AbortSignal): Promise<any>
  export function filterAnime(params: any, signal?: AbortSignal): Promise<any>
  export function getAnimeById(id: number, signal?: AbortSignal): Promise<any>
  export function getAnimeBySlug(slug: string, signal?: AbortSignal): Promise<any>
  export function getHomePage(signal?: AbortSignal): Promise<any>
  export function getEpisodes(malId: number, signal?: AbortSignal): Promise<any>
  export function syncEpisodes(malId: number): Promise<any>
  export function getEpisodePlayData(malId: number, episodeUrl: string, signal?: AbortSignal): Promise<any>
  export function getEpisodeEmbed(malId: number, episodeUrl: string, signal?: AbortSignal): Promise<any>
  export function getAnimeState(id: number, signal?: AbortSignal): Promise<any>
  export function getSeasonal(page?: number, size?: number, signal?: AbortSignal): Promise<any>
  export function getReviews(animeId: number, page?: number, size?: number, signal?: AbortSignal): Promise<any>
  export function addReview(animeId: number, starRating: number, comment: string): Promise<any>
  export function getStreamableBatch(malIds: number[]): Promise<number[]>
  export function getComingSoonAnime(page?: number, size?: number, signal?: AbortSignal): Promise<any>
  export function isComingSoon(malId: number): Promise<boolean>
  export function getEpisodeLanguages(malId: number, episodeUrl: string, signal?: AbortSignal): Promise<any>
  export function getEpisodeStreams(malId: number, episodeUrl: string, language?: string, signal?: AbortSignal): Promise<any>
  export function getAnimeStates(ids: number[], signal?: AbortSignal): Promise<any>
  export function createStreamToken(embedUrl: string, signal?: AbortSignal): Promise<any>
  export function getFavorites(signal?: AbortSignal): Promise<any[]>
  export function addFavorite(animeId: number): Promise<any>
  export function removeFavorite(animeId: number): Promise<any>
  export function getWatchlist(signal?: AbortSignal): Promise<any[]>
  export function addToWatchlist(animeId: number, status: string): Promise<any>
  export function updateWatchlistStatus(id: number, status: string): Promise<any>
  export function removeFromWatchlist(id: number): Promise<any>
  export function deleteReview(id: number): Promise<any>
  export function getResume(malId: number, signal?: AbortSignal): Promise<any>
  export function getContinueWatching(signal?: AbortSignal): Promise<any[]>
  export function saveResume(malId: number, data: {
    episodeNumber: number
    progressSeconds: number
    durationSeconds: number
    animeTitle: string
    animeImage: string
  }): Promise<any>

  export function registerPushToken(expoPushToken: string, platform: string): Promise<AxiosResponse>
  export function unregisterPushToken(expoPushToken: string): Promise<AxiosResponse>
  export function getNotificationPreferences(): Promise<AxiosResponse>
  export function updateNotificationPreferences(preferences: Record<string, boolean>): Promise<AxiosResponse>
  export function sendTestNotification(): Promise<AxiosResponse>
}

declare module '@anime/auth' {
  import { ReactNode } from 'react'
  import { TokenStore } from '@anime/api'

  export interface AuthContextType {
    user: any | null
    isAuthenticated: boolean
    loading: boolean
    login: (email: string, password: string) => Promise<any>
    register: (name: string, email: string, password: string) => Promise<any>
    logout: () => Promise<void>
  }

  export function createStorage(adapters: {
    getItem: (key: string) => Promise<string | null>
    setItem: (key: string, value: string) => Promise<void>
    removeItem: (key: string) => Promise<void>
  }): TokenStore

  export function AuthProvider(props: {
    children: ReactNode
    storage: TokenStore
    apiClient: any
  }): JSX.Element

  export function useAuth(): AuthContextType
}

declare module '@anime/constants' {
  export const GENRES: string[]
  export const SORT_OPTIONS: { label: string; value: string }[]
  export const SEASONS: string[]
}

declare module '@anime/utils' {
  export function isValidAnime(anime: any): { valid: boolean; reasons: string[] }
  export function filterAndLog(items: any[], source: string): any[]
  export function withFallback(fetchFn: any, validateFn: any, targetCount: number, maxPages?: number): { fetch: () => Promise<any[]> }
  export function getAnimeImage(anime: any): string
  export function isPlaceholderImage(url: string | null | undefined): boolean
}

declare module '@anime/types' {
  export type { Anime, Genre, Studio, AnimeState, HomePageData } from '@anime/types'
  export type { Episode, PlayData, LanguageGroup, ServerOption } from '@anime/types'
  export type { User, AuthResponse } from '@anime/types'
  export type { WatchlistItem } from '@anime/types'
  export type { Review } from '@anime/types'
  export type { NewsArticle } from '@anime/types'
  export type { ApiResponse, PagedResponse } from '@anime/types'
}

declare module '*.css' {
  const content: Record<string, string>
  export default content
}
