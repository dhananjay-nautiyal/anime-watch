// Standalone Vitest config.
//
// It deliberately does NOT extend vite.config.js: vitest brings its own vite
// (5.x), while vite.config.js loads @vitejs/plugin-react@3 which pins vite ^4.
// Pulling the React plugin into the test runner would couple it to the app's
// bundler version for no benefit — these tests cover the API layer, not JSX.
//
// The @anime/* alias below mirrors the one in vite.config.js so tests resolve
// the shared workspace packages exactly like `vite build` does (there are no
// node_modules links for them; the alias is the only resolution path).
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const here = path.dirname(fileURLToPath(import.meta.url))
const packagesDir = path.resolve(here, '../packages')
const src = name => path.resolve(packagesDir, name, 'src')

export default defineConfig({
  resolve: {
    alias: {
      '@anime/api': src('api'),
      '@anime/auth': src('auth'),
      '@anime/constants': src('constants'),
      '@anime/hooks': src('hooks'),
      '@anime/types': src('types'),
      '@anime/utils': src('utils'),
    },
  },
  test: {
    environment: 'node',
    // Scoped to this app's sources so packages/** and mobile/** keep owning
    // their own test runs.
    include: ['src/**/*.{test,spec}.{js,mjs,jsx,ts,tsx}'],
    reporters: ['default'],
  },
})
