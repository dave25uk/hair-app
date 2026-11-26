import { useState, type FormEvent } from 'react'
import { Alert, Field } from '../components/ui'
import { useAuth } from '../state/AuthContext'

type Mode = 'sign-in' | 'sign-up'

/**
 * The only screen shown without a session. Both modes live on one form so the
 * user never loses what they typed when they switch.
 */
export default function AuthPage() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<Mode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const isSignUp = mode === 'sign-up'

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setNotice(null)
    setPassword('')
    setConfirmation('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setNotice(null)

    const address = email.trim()
    if (!address) {
      setError('Enter your email address.')
      return
    }
    if (isSignUp && password.length < 8) {
      setError('Use at least 8 characters for your password.')
      return
    }
    if (isSignUp && password !== confirmation) {
      setError('The two passwords do not match.')
      return
    }

    setBusy(true)
    try {
      if (isSignUp) {
        const { needsConfirmation } = await signUp(address, password)
        if (needsConfirmation) {
          setNotice(
            `Account created. Open the confirmation link sent to ${address}, then sign in here.`,
          )
          setMode('sign-in')
          setPassword('')
          setConfirmation('')
        }
      } else {
        await signIn(address, password)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign you in. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="centre-screen">
      <div className="card auth-card">
        <div className="auth-brand">
          <img
            className="auth-mark"
            src={`${import.meta.env.BASE_URL}favicon.svg`}
            alt=""
            width={34}
            height={34}
          />
          <span className="auth-brand-name">Hair Tracker</span>
        </div>

        <div className="auth-intro">
          <h1>{isSignUp ? 'Create your account' : 'Welcome back'}</h1>
          <p>
            {isSignUp
              ? 'One account keeps your fittings, costs and dates together, on every device.'
              : 'Sign in to open your fittings, costs and dates.'}
          </p>
        </div>

        <form className="form" onSubmit={handleSubmit}>
          {error && <Alert>{error}</Alert>}
          {notice && <Alert tone="ok">{notice}</Alert>}

          <Field label="Email" htmlFor="auth-email">
            <input
              id="auth-email"
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>

          <Field
            label="Password"
            htmlFor="auth-password"
            hint={isSignUp ? 'At least 8 characters.' : undefined}
          >
            <input
              id="auth-password"
              type="password"
              name="password"
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>

          {isSignUp && (
            <Field label="Confirm password" htmlFor="auth-password-confirm">
              <input
                id="auth-password-confirm"
                type="password"
                name="password-confirm"
                autoComplete="new-password"
                required
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </Field>
          )}

          <button type="submit" className="button button--primary button--block" disabled={busy}>
            {busy ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <button
          type="button"
          className="button button--ghost button--block"
          onClick={() => switchMode(isSignUp ? 'sign-in' : 'sign-up')}
          disabled={busy}
        >
          {isSignUp ? 'I already have an account' : 'Create an account'}
        </button>

        <p className="auth-footnote">
          Your record is private to this login. The app keeps the last download on this device, so
          it still opens offline, read-only.
        </p>
      </div>
    </div>
  )
}
