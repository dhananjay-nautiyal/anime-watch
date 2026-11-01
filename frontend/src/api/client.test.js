// Smoke tests for the web API layer (frontend/src/api/client.js).
//
// They guard the wiring web relies on: the wrapper resolves the shared
// @anime/api client through the @anime/* alias (the same resolution path
// `vite build` uses), keeps the axios instance and the module-level base URL
// in sync, and re-exports the error helpers the UI calls. Deeper interceptor /
// refresh-token behaviour is covered in packages/api/src/client.test.mjs.
import { afterEach, describe, expect, it } from 'vitest'
import client, {
  configureTokenStorage,
  extractErrorCode,
  extractErrorMessage,
  getApiBaseURL,
  setApiBaseURL,
} from './client.js'

// setApiBaseURL mutates module state, so put it back between tests.
const initialBaseURL = getApiBaseURL()
afterEach(() => setApiBaseURL(initialBaseURL))

describe('frontend API wrapper', () => {
  it('re-exports the shared client and its helpers', () => {
    expect(typeof getApiBaseURL).toBe('function')
    expect(typeof setApiBaseURL).toBe('function')
    expect(typeof configureTokenStorage).toBe('function')
    expect(typeof extractErrorMessage).toBe('function')
    expect(typeof extractErrorCode).toBe('function')

    // The default export is the shared axios instance, not a copy.
    expect(client).toBeTruthy()
    expect(typeof client.request).toBe('function')
    expect(client.defaults.timeout).toBe(25000)
  })

  it('keeps the axios instance in sync with the configured base URL', () => {
    setApiBaseURL('  https://api.example.com/  ')
    // Trimmed and trailing slash stripped — the contract callers rely on.
    expect(getApiBaseURL()).toBe('https://api.example.com')
    expect(client.defaults.baseURL).toBe('https://api.example.com')
  })

  it('uses relative URLs when no base URL is configured', () => {
    // An empty VITE_API_URL must stay empty so web dev goes through the
    // Vite /api proxy instead of a placeholder host.
    setApiBaseURL('')
    expect(getApiBaseURL()).toBe('')
    expect(client.defaults.baseURL).toBe('')
  })

  it('starts from the environment-provided base URL', () => {
    const fromEnv = (import.meta.env?.EXPO_PUBLIC_API_URL || import.meta.env?.VITE_API_URL || '')
      .trim()
      .replace(/\/$/, '')
    expect(initialBaseURL).toBe(fromEnv)
  })
})

describe('extractErrorMessage', () => {
  it('prefers the message returned by the server', () => {
    expect(extractErrorMessage({ response: { data: { message: 'Title not found' } } })).toBe(
      'Title not found',
    )
  })

  it('explains timeouts', () => {
    expect(extractErrorMessage({ code: 'ECONNABORTED' })).toBe(
      'Request timed out. The server may be busy.',
    )
  })

  it('explains network failures', () => {
    expect(extractErrorMessage(new Error('Network Error'))).toBe(
      'Network error. Check your connection.',
    )
  })

  it('maps rate limiting and server errors', () => {
    expect(extractErrorMessage({ response: { status: 429 } })).toBe(
      'Too many requests. Please wait a moment and try again.',
    )
    expect(extractErrorMessage({ response: { status: 503 } })).toBe(
      'Server error. Please try again later.',
    )
  })

  it('falls back to a generic message', () => {
    expect(extractErrorMessage({ response: { status: 404 } })).toBe(
      'Something went wrong. Please try again.',
    )
  })
})

describe('extractErrorCode', () => {
  it('reads a code from the error itself', () => {
    expect(extractErrorCode({ errorCode: 'NOT_FOUND' })).toBe('NOT_FOUND')
  })

  it('reads a code from the response body', () => {
    expect(extractErrorCode({ response: { data: { errorCode: 'PROVIDER_DOWN' } } })).toBe(
      'PROVIDER_DOWN',
    )
  })

  it('returns null when the server sent no code', () => {
    expect(extractErrorCode({ response: { data: {} } })).toBeNull()
    expect(extractErrorCode({})).toBeNull()
  })
})

describe('configureTokenStorage', () => {
  it('accepts a token store implementing the storage contract', () => {
    const store = {
      getToken: () => Promise.resolve('access'),
      setToken: () => Promise.resolve(),
      getRefreshToken: () => Promise.resolve('refresh'),
      setRefreshToken: () => Promise.resolve(),
      clearTokens: () => Promise.resolve(),
    }
    expect(() => configureTokenStorage(store)).not.toThrow()
  })
})
