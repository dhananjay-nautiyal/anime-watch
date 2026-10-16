export interface MediaStream {
  url: string
  label: string
  quality?: string
  mimeType?: string
}

export interface SourceProvider {
  id: string
  name: string
  manifestUrl?: string
  /** Resolve playable streams for a media item using an extension contract. */
  resolve(title: string, year?: number): Promise<MediaStream[]>
  /** Optional health check used by the Extensions screen. */
  test(): Promise<{ ok: boolean; message: string }>
}

export const DEFAULT_PROVIDERS: SourceProvider[] = [
  {
    id: 'trailers',
    name: 'TMDB Trailers',
    async resolve(_title, _year) {
      return []
    },
    async test() {
      return { ok: true, message: 'Built-in trailer resolver is available' }
    },
  },
]