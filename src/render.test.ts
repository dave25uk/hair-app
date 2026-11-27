import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Session } from '@supabase/supabase-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EmptyState, Spinner, Alert } from './components/ui'

/**
 * Server-rendered smoke tests: they do not need a DOM, but they do prove the
 * module graph loads and the main screens render without throwing.
 */
describe('server render smoke', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('renders the setup screen when env vars are missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    vi.resetModules()
    const { default: AppWithoutEnv } = await import('./App')
    const html = renderToStaticMarkup(createElement(AppWithoutEnv))
    expect(html).toContain('Almost there')
    expect(html).toContain('.env.local')
  }, 30_000)

  it('asks for a sign-in before showing the app', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key')
    vi.resetModules()
    const { default: AppWithEnv } = await import('./App')
    const html = renderToStaticMarkup(createElement(AppWithEnv))
    // The auth gate shows the loading state; the app shell stays hidden.
    expect(html).toContain('Checking your session')
    expect(html).not.toContain('app-header')
  }, 30_000)

  it('renders email and password fields on the sign-in page', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key')
    vi.resetModules()
    const { AuthProvider } = await import('./state/AuthContext')
    const { default: AuthPage } = await import('./pages/AuthPage')
    const html = renderToStaticMarkup(
      createElement(AuthProvider, null, createElement(AuthPage)),
    )
    expect(html).toContain('Welcome back')
    expect(html).toContain('type="email"')
    expect(html).toContain('type="password"')
    expect(html).toContain('Sign in')
    expect(html).toContain('Create an account')
  }, 30_000)

  it('treats a leftover anonymous session as signed out', async () => {
    vi.resetModules()
    const { usableSession } = await import('./state/AuthContext')
    const guest = { user: { id: 'guest', is_anonymous: true } } as unknown as Session
    const real = { user: { id: 'user', is_anonymous: false } } as unknown as Session
    expect(usableSession(null)).toBeNull()
    expect(usableSession(guest)).toBeNull()
    expect(usableSession(real)).toBe(real)
  })

  it('renders the re-fit hero and the current-system card with real data', async () => {
    vi.resetModules()
    vi.doMock('./state/AppDataContext', () => ({
      useAppData: () => ({
        status: 'ready',
        error: null,
        refresh: async () => {},
        offlineSnapshot: false,
        snapshotSavedAt: null,
        data: {
          settings: {
            refitIntervalDays: 28,
            newSystemIntervalDays: 120,
            stylistLeadDays: 14,
            orderLeadDays: 21,
            currency: 'GBP',
          },
          fittings: [
            {
              id: 'f1',
              kind: 'new-system',
              fittedOn: '2026-01-20',
              removedOn: null,
              comments: '',
              createdAt: '2026-01-20T09:00:00.000Z',
            },
          ],
          costs: [
            {
              id: 'c1',
              spentOn: '2026-01-20',
              category: 'system',
              amountMinor: 90000,
              note: '',
              createdAt: '2026-01-20T09:00:00.000Z',
            },
          ],
        },
      }),
    }))

    const { default: HomePage } = await import('./pages/HomePage')
    const html = renderToStaticMarkup(createElement(HomePage, { onNavigate: () => {} }))

    // Hero: the re-fit countdown plus the session details it now owns.
    expect(html).toContain('hero-stats')
    expect(html).toContain('On since')
    expect(html).toContain('Days worn')
    expect(html).toContain('Re-fit due')

    // Current-system card: the replacement dates that used to live in the hero.
    expect(html).toContain('Current system')
    expect(html).toContain('New system due')
    expect(html).toContain('Order by')
    expect(html).toContain('Stylist by')

    // At a glance: the new monthly average, without the removed hints.
    expect(html).toContain('Average monthly cost')
    expect(html).toContain('since Jan 2026')
    expect(html).not.toContain('sessions logged')
    expect(html).not.toContain('Currently wearing')

    vi.doUnmock('./state/AppDataContext')
  }, 30_000)

  it('renders shared building blocks', () => {
    expect(renderToStaticMarkup(createElement(Spinner, { label: 'Loading' }))).toContain(
      'spinner-ring',
    )
    expect(
      renderToStaticMarkup(
        createElement(EmptyState, { title: 'Nothing here', description: 'Add something first.' }),
      ),
    ).toContain('Nothing here')
    expect(renderToStaticMarkup(createElement(Alert, { tone: 'warn', children: 'Careful' }))).toBe(
      '<div class="alert alert--warn" role="status">Careful</div>',
    )
  })
})
