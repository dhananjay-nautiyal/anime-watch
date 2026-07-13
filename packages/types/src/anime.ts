export interface Anime {
  id?: number
  malId?: number
  title?: string
  titleEnglish?: string
  titleJapanese?: string
  synopsis?: string
  image?: string
  poster?: string
  coverImage?: string
  imageUrl?: string
  images?: {
    jpg?: { image_url?: string; large_image_url?: string; small_image_url?: string }
    webp?: { image_url?: string; large_image_url?: string; small_image_url?: string }
  }
  type?: string
  episodes?: number
  status?: string
  rating?: string
  score?: number
  rank?: number
  popularity?: number
  season?: string
  year?: number
  duration?: string
  source?: string
  genres?: Genre[]
  studios?: Studio[]
  producers?: Producer[]
  licensors?: Licensor[]
  themes?: Theme[]
  externalLinks?: ExternalLink[]
  slug?: string
  trailerUrl?: string
  recommendationCount?: number
  createdAt?: string
  updatedAt?: string
}

export interface Genre {
  id?: number
  name?: string
  type?: string
}

export interface Studio {
  id?: number
  name?: string
}

export interface Producer {
  id?: number
  name?: string
}

export interface Licensor {
  id?: number
  name?: string
}

export interface Theme {
  id?: number
  name?: string
  type?: string
}

export interface ExternalLink {
  url?: string
  name?: string
}

export interface AnimeState {
  inWatchlist?: boolean
  watchlistStatus?: string
  isFavorite?: boolean
  comingSoon?: boolean
}

export interface HomePageData {
  trending?: Anime[]
  popular?: Anime[]
  topRated?: Anime[]
  latestEpisodes?: Anime[]
  seasonal?: Anime[]
  continueWatching?: Anime[]
}
