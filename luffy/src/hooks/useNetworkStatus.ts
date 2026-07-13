import { useState, useEffect } from 'react'

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.addEventListener) return

    const onlineHandler = () => setIsOnline(true)
    const offlineHandler = () => setIsOnline(false)

    window.addEventListener('online', onlineHandler)
    window.addEventListener('offline', offlineHandler)
    setIsOnline(navigator.onLine)

    return () => {
      window.removeEventListener('online', onlineHandler)
      window.removeEventListener('offline', offlineHandler)
    }
  }, [])

  return isOnline
}
