import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthContextValue {
  session: Session | null
  /** True while the saved session is being read from storage. */
  loading: boolean
  error: string | null
  signIn(email: string, password: string): Promise<void>
  /** Resolves with needsConfirmation when the project requires an email link. */
  signUp(email: string, password: string): Promise<{ needsConfirmation: boolean }>
  signOut(): Promise<void>
  retry(): void
}

const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * The previous build opened a silent anonymous session. A browser that used it
 * still holds that token, and it must not count as a sign-in — otherwise the
 * login screen would never appear. The token is left in place (it is replaced
 * on the next sign-in) and the guest rows stay recoverable with the SQL in the
 * README.
 */
export function usableSession(session: Session | null): Session | null {
  if (!session) return null
  return session.user.is_anonymous ? null : session
}

function describeError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  if (/invalid login credentials/i.test(message)) {
    return 'That email and password do not match an account.'
  }
  if (/email not confirmed/i.test(message)) {
    return 'This account still needs its email confirmed — open the link we emailed you, then sign in.'
  }
  if (/already registered|already been registered/i.test(message)) {
    return 'That email already has an account. Sign in instead.'
  }
  if (/password should be at least/i.test(message)) {
    return 'That password is too short for this project. Try a longer one.'
  }
  if (/rate limit|too many requests|for security purposes/i.test(message)) {
    return 'Too many attempts. Wait a minute and try again.'
  }
  if (/fetch|network/i.test(message)) {
    return 'Could not reach the server. Check your connection and try again.'
  }
  return message || 'Something went wrong. Please try again.'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const client = supabase
    if (!client) {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    void (async () => {
      try {
        const { data, error: sessionError } = await client.auth.getSession()
        if (sessionError) throw sessionError
        if (cancelled) return
        setSession(usableSession(data.session))
      } catch (err) {
        if (!cancelled) setError(describeError(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    // Keeps the app in step with sign-in, sign-out, token refresh and the
    // email-confirmation redirect (which arrives with the token in the URL).
    const { data: listener } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(usableSession(nextSession))
      setLoading(false)
    })

    return () => {
      cancelled = true
      listener.subscription.unsubscribe()
    }
  }, [attempt])

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase is not configured.')
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (signInError) throw new Error(describeError(signInError))
    setSession(usableSession(data.session))
    setError(null)
  }, [])

  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase is not configured.')
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError) throw new Error(describeError(signUpError))
    if (data.session) {
      setSession(usableSession(data.session))
      setError(null)
      return { needsConfirmation: false }
    }
    // Email confirmation is on: there is no session until the link is opened.
    return { needsConfirmation: true }
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) return
    const { error: signOutError } = await supabase.auth.signOut()
    if (signOutError) throw new Error(describeError(signOutError))
    setSession(null)
  }, [])

  const retry = useCallback(() => setAttempt((count) => count + 1), [])

  const value = useMemo<AuthContextValue>(
    () => ({ session, loading, error, signIn, signUp, signOut, retry }),
    [session, loading, error, signIn, signUp, signOut, retry],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>')
  return value
}
