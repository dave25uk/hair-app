import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Hosts disagree about where the app lives: Vercel and Netlify serve it from
 * the domain root, while a GitHub Pages project site lives under /hair-app/.
 * The Pages workflow sets VITE_BASE; everywhere else "/" is the right default.
 *
 * Getting this wrong is what produces a blank page — index.html loads, then its
 * script and stylesheet 404, so #root stays empty.
 */
function normalizeBase(value: string | undefined): string {
  const trimmed = value?.trim()
  if (!trimmed || trimmed === '/') return '/'
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`
}

export default defineConfig(({ mode }) => {
  // loadEnv also picks up real environment variables, which is how Vercel and
  // the Pages workflow pass VITE_BASE in. Using it keeps `process` out of this
  // file, since the tsconfig only loads the vite/client types.
  const BASE = normalizeBase(loadEnv(mode, '.', '').VITE_BASE)

  return {
    base: BASE,
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
        manifest: {
          id: BASE,
          name: 'Hair Tracker',
          short_name: 'Hair Tracker',
          description: 'Track hair system fittings, re-fits and running costs.',
          lang: 'en-GB',
          start_url: BASE,
          scope: BASE,
          display: 'standalone',
          orientation: 'portrait',
          theme_color: '#f8f4ef',
          background_color: '#f8f4ef',
          categories: ['lifestyle', 'health', 'productivity'],
          icons: [
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            {
              src: 'maskable-icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
          navigateFallback: 'index.html',
          cleanupOutdatedCaches: true,
        },
      }),
    ],
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
    build: {
      // supabase-js is most of the bundle; a single prefetched chunk keeps the
      // offline story simple, so nudge the warning threshold past it.
      chunkSizeWarningLimit: 700,
    },
  }
})
