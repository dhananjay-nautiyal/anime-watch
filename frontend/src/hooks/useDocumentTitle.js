import { useEffect } from 'react'

export function useDocumentTitle(title) {
  useEffect(() => {
    const prev = document.title
    document.title = title ? `${title} - WatchAnime` : 'WatchAnime - Premium Anime Streaming'
    return () => { document.title = prev }
  }, [title])
}
