export interface Episode {
  id?: number
  malId?: number
  episodeNumber?: number
  title?: string
  titleJapanese?: string
  titleRomanji?: string
  aired?: string
  score?: number
  filler?: boolean
  recap?: boolean
  embedUrl?: string
  imageUrl?: string
}

export interface PlayData {
  type?: string
  languages?: LanguageGroup[]
  availableLanguages?: string[]
  referer?: string
}

export interface LanguageGroup {
  language: string
  servers: ServerOption[]
}

export interface ServerOption {
  url: string
  proxyUrl?: string
  name?: string
  verified?: boolean
  status?: string
}

export interface StreamPayload {
  embedUrl?: string
  type?: string
  referer?: string
  servers?: ServerOption[]
}
