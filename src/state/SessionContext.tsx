import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

const DEVICE_KEY = 'hair-app.device.v1'

interface SessionContextValue {
  session: Session | null
  loading: boolean
  error: string | null
  /** True when this browser used the app before but its session is gone. */
  canStartFresh: boolean
  retry(): void
  startFresh(): void
}

const SessionContext = createContext<SessionContextValue | null>(null)

function hasUsedDevice(): boolean {
  try {
    return localStorage.getItem(DEVICE_KEY) === '1'
  } catch {
    return false
  }
}

function rememberDevice(): void {
  try {
    localStorage.setItem(DEVICE_KEY, '1')
  } catch {
    // Storage blocked (private mode) — the session still works for this visit.
  }
}

function forgetDevice(): void {
  try {
    localStorage.removeItem(DEVICE_KEY)
  } catch {
    // ignore
  }
}

function describeError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  if (/anonymous/i.test(message)) {
    return 'This Supabase project has anonymous sign-ins turned off, so the app cannot open a session. Turn them on under Authentication → Sign In / Providers → Anonymous sign-ins, then try again.'
  }
  return message || 'Could not open a session.'
}

const LOST_MESSAGE =
  'This browser used the app before, but its saved session is gone. The old record belongs to that session, so it cannot be opened from here. Exporting a JSON copy is the way back. Start a new record only if you are happy to begin again.'

type BootstrapResult =
  | { kind: 'session'; session: Session }
  | { kind: 'lost' }
  | { kind: 'error'; message: string }

/**
 * Shared across mounts: React StrictMode runs effects twice in development, and
 * two concurrent sign-ins would leave two identities (and a user id that does
 * not match the stored token) behind.
 */
let inFlight: Promise<BootstrapResult> | null = null

async function openSession(client: NonNullable<typeof supabase>): Promise<BootstrapResult> {
  try {
    const existing = await client.auth.getSession()
    if (existing.error) throw existing.error
    if (existing.data.session) return { kind: 'session', session: existing.data.session }

    // A device that has been here before but lost its session must not be
    // quietly given a new, empty identity — that looks like lost history.
    if (hasUsedDevice()) return { kind: 'lost' }

    const created = await client.auth.signInAnonymously()
    if (created.error) throw created.error
    if (!created.data.session) return { kind: 'error', message: 'Supabase returned no session.' }
    return { kind: 'session', session: created.data.session }
  } catch (err) {
    return { kind: 'error', message: describeError(err) }
  }
}

function bootstrapSession(client: NonNullable<typeof supabase>): Promise<BootstrapResult> {
  if (!inFlight) {
    inFlight = openSession(client)
    void inFlight.then(() => {
      inFlight = null
    })
  }
  return inFlight
}

function resetBootstrap(): void {
  inFlight = null
}

/**
 * The app is for one person, so there is no sign-in screen: on first load we
 * mint a silent anonymous Supabase session and keep it in this browser. Row
 * level security still applies, because every row is owned by that session's
 * user id — nothing is shared and no secret ships in the bundle.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(Boolean(supabase))
  const [error, setError] = useState<string | null>(null)
  const [canStartFresh, setCanStartFresh] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const bootstrapped = useRef(false)

  const retry = useCallback(() => {
    resetBootstrap()
    setAttempt((count) => count + 1)
  }, [])

  const startFresh = useCallback(() => {
    forgetDevice()
    resetBootstrap()
    setCanStartFresh(false)
    setAttempt((count) => count + 1)
  }, [])

  useEffect(() => {
    if (!supabase) return
    const client = supabase
    let active = true

    setLoading(true)
    setError(null)
    setCanStartFresh(false)

    async function start() {
      const result = await bootstrapSession(client)
      if (!active) return

      if (result.kind === 'session') {
        rememberDevice()
        setSession(result.session)
      } else if (result.kind === 'lost') {
        setCanStartFresh(true)
        setError(LOST_MESSAGE)
      } else {
        setError(result.message)
      }

      bootstrapped.current = true
      setLoading(false)
    }

    void start()

    const { data: listener } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (nextSession) {
        rememberDevice()
        setSession(nextSession)
        setLoading(false)
        return
      }
      // Ignore the empty event Supabase fires while the first load is in flight.
      if (!bootstrapped.current) return
      setSession(null)
      setLoading(false)
      setError('The session for this device has ended. Try again to reconnect.')
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [attempt])

  const value = useMemo<SessionContextValue>(
    () => ({ session, loading, error, canStartFresh, retry, startFresh }),
    [session, loading, error, canStartFresh, retry, startFresh],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession must be used inside <SessionProvider>')
  return value
}
