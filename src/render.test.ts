import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
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

  it('opens without a sign-in screen', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key')
    vi.resetModules()
    const { default: AppWithEnv } = await import('./App')
    const html = renderToStaticMarkup(createElement(AppWithEnv))
    // The session gate shows the loading state; no form and no password field.
    expect(html).toContain('Opening your data')
    expect(html).not.toContain('type="password"')
    expect(html).not.toContain('Sign in')
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
