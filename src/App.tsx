import { useEffect, useState } from 'react'
import { SessionProvider, useSession } from './state/SessionContext'
import { AppDataProvider } from './state/AppDataContext'
import { hasSupabaseConfig } from './lib/supabase'
import HomePage from './pages/HomePage'
import FittingsPage from './pages/FittingsPage'
import CostsPage from './pages/CostsPage'
import SettingsPage from './pages/SettingsPage'
import { Spinner } from './components/ui'
import { CogIcon, CoinsIcon, HomeIcon, ScissorsIcon } from './components/icons'

const TABS = [
  { id: 'home', label: 'Home', Icon: HomeIcon },
  { id: 'fittings', label: 'Fittings', Icon: ScissorsIcon },
  { id: 'costs', label: 'Costs', Icon: CoinsIcon },
  { id: 'settings', label: 'Settings', Icon: CogIcon },
] as const

export type Tab = (typeof TABS)[number]['id']

function readTab(): Tab {
  const raw = window.location.hash.replace(/^#\/?/, '')
  return TABS.some((item) => item.id === raw) ? (raw as Tab) : 'home'
}

function AppShell() {
  const [tab, setTab] = useState<Tab>(readTab)

  useEffect(() => {
    const onHashChange = () => setTab(readTab())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const navigate = (next: Tab) => {
    if (window.location.hash !== `#/${next}`) window.location.hash = `/${next}`
    setTab(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <img
            className="brand-mark"
            src={`${import.meta.env.BASE_URL}favicon.svg`}
            alt=""
            width={30}
            height={30}
          />
          <span className="brand-name">Hair Tracker</span>
        </div>
        <nav className="tabs" aria-label="Sections">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              className={tab === id ? 'tab is-active' : 'tab'}
              aria-current={tab === id ? 'page' : undefined}
              onClick={() => navigate(id)}
            >
              <Icon className="tab-icon" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </header>

      <main className="app-main">
        {tab === 'home' && <HomePage onNavigate={navigate} />}
        {tab === 'fittings' && <FittingsPage />}
        {tab === 'costs' && <CostsPage />}
        {tab === 'settings' && <SettingsPage />}
      </main>
    </div>
  )
}

function SessionGate() {
  const { session, loading, error, canStartFresh, retry, startFresh } = useSession()

  if (loading) {
    return (
      <div className="centre-screen">
        <Spinner label="Opening your data" />
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="centre-screen">
        <div className="card setup-card">
          <h1>Can't open the app</h1>
          <p>{error ?? 'No session could be started on this device.'}</p>
          <div className="row-actions">
            <button type="button" className="button button--primary" onClick={retry}>
              Try again
            </button>
            {canStartFresh && (
              <button type="button" className="button button--ghost" onClick={startFresh}>
                Start a new record
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <AppDataProvider>
      <AppShell />
    </AppDataProvider>
  )
}

function SetupScreen() {
  return (
    <div className="centre-screen">
      <div className="card setup-card">
        <h1>Almost there</h1>
        <p>
          This app needs a Supabase URL and anon key before it can run. Copy{' '}
          <code>.env.example</code> to <code>.env.local</code> and fill in both values, then
          restart the dev server (or add the same values as GitHub Actions secrets for the
          deployed build).
        </p>
        <pre>
          <code>{'VITE_SUPABASE_URL=…\nVITE_SUPABASE_ANON_KEY=…'}</code>
        </pre>
        <p className="muted">
          The anon key is safe in a browser bundle: every table is protected by row level
          security.
        </p>
      </div>
    </div>
  )
}

export default function App() {
  if (!hasSupabaseConfig) return <SetupScreen />

  return (
    <SessionProvider>
      <SessionGate />
    </SessionProvider>
  )
}
