// Vite-processed wrapper: this file MAY use `import.meta.env` (unlike
// `packages/api/src/client.js`, which must stay Hermes-parseable).
// An empty VITE_API_URL intentionally stays empty so web dev requests
// stay relative and go through the Vite `/api` -> localhost:8080 proxy.
import { setApiBaseURL } from '@anime/api/client'

const viteUrl = ((import.meta.env?.EXPO_PUBLIC_API_URL || import.meta.env?.VITE_API_URL) ?? '').trim()
if (viteUrl) {
  setApiBaseURL(viteUrl)
}

export {
  default as default,
  configureTokenStorage,
  extractErrorMessage,
  extractErrorCode,
  getApiBaseURL,
  setApiBaseURL,
} from '@anime/api/client'
