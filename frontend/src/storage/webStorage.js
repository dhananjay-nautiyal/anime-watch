import { createStorage } from '@anime/auth'

function safeGet(key) {
  try { return Promise.resolve(localStorage.getItem(key)) }
  catch { return Promise.resolve(null) }
}

function safeSet(key, value) {
  try { localStorage.setItem(key, value) } catch {}
  return Promise.resolve()
}

function safeRemove(key) {
  try { localStorage.removeItem(key) } catch {}
  return Promise.resolve()
}

export const webStorage = createStorage({
  getItem: safeGet,
  setItem: safeSet,
  removeItem: safeRemove,
})
