import { useState, useCallback } from 'react'

export function useLocalStorage(key, initialValue, storage) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      if (storage) {
        return initialValue
      }
      if (typeof window !== 'undefined' && window.localStorage) {
        const item = window.localStorage.getItem(key)
        return item ? JSON.parse(item) : initialValue
      }
      return initialValue
    } catch {
      return initialValue
    }
  })

  const setValue = useCallback((value) => {
    const valueToStore = value instanceof Function ? value(storedValue) : value
    setStoredValue(valueToStore)
    try {
      if (storage) {
        storage.setItem(key, JSON.stringify(valueToStore))
      } else if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, JSON.stringify(valueToStore))
      }
    } catch {}
  }, [key, storedValue, storage])

  return [storedValue, setValue]
}
