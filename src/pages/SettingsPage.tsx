import { useEffect, useState, type FormEvent } from 'react'
import { useAppData } from '../state/AppDataContext'
import { useAuth } from '../state/AuthContext'
import { Alert, Card, Field } from '../components/ui'
import { DataGate } from '../components/DataGate'
import { OfflineNotice } from '../components/OfflineNotice'
import { clearCache, downloadJson } from '../lib/cache'
import { addDaysISO, formatDate, todayISO } from '../lib/dates'
import type { Settings } from '../types'

const CURRENCIES = ['GBP', 'EUR', 'USD', 'AUD', 'CAD', 'NZD', 'ZAR', 'CHF', 'SEK']

export default function SettingsPage() {
  const { data, saveSettings, refresh, offlineSnapshot } = useAppData()
  const { session, signOut } = useAuth()

  const [form, setForm] = useState<Settings>(data.settings)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)

  useEffect(() => {
    setForm(data.settings)
  }, [data.settings])

  const dirty = JSON.stringify(form) !== JSON.stringify(data.settings)

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setForm((previous) => ({ ...previous, [key]: value }))
    setNotice(null)
  }

  const sampleDue = addDaysISO('2026-01-01', form.newSystemIntervalDays)
  const sampleStylist = addDaysISO(sampleDue, -form.stylistLeadDays)
  const sampleOrder = addDaysISO(sampleStylist, -form.orderLeadDays)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setNotice(null)

    if (!Number.isFinite(form.newSystemIntervalDays) || form.newSystemIntervalDays < 1) {
      setError('System life must be at least 1 day.')
      return
    }
    if (!Number.isFinite(form.refitIntervalDays) || form.refitIntervalDays < 1) {
      setError('The re-fit interval must be at least 1 day.')
      return
    }
    if (form.stylistLeadDays < 0 || form.orderLeadDays < 0) {
      setError('Lead times cannot be negative.')
      return
    }
    if (form.stylistLeadDays + form.orderLeadDays >= form.newSystemIntervalDays) {
      setError('Stylist and order lead times add up to more than the life of a system.')
      return
    }

    setSaving(true)
    try {
      await saveSettings({
        ...form,
        refitIntervalDays: Math.round(form.refitIntervalDays),
        newSystemIntervalDays: Math.round(form.newSystemIntervalDays),
        stylistLeadDays: Math.round(form.stylistLeadDays),
        orderLeadDays: Math.round(form.orderLeadDays),
      })
      setNotice('Settings saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your settings.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSignOut() {
    setSignOutError(null)
    setSigningOut(true)
    try {
      await signOut()
      clearCache()
    } catch (err) {
      setSignOutError(err instanceof Error ? err.message : 'Could not sign out.')
      setSigningOut(false)
    }
  }

  function handleExport() {
    downloadJson(`hair-tracker-${todayISO()}.json`, {
      exportedAt: new Date().toISOString(),
      settings: data.settings,
      fittings: data.fittings,
      costs: data.costs,
    })
  }

  return (
    <DataGate>
      <div className="page">
        <OfflineNotice />

        <header className="page-head">
          <div>
            <h1>Settings</h1>
            <p className="muted">Intervals, currency and your data.</p>
          </div>
        </header>

        <Card>
          <header className="card-head">
            <h2>Account</h2>
          </header>
          <p className="muted small">
            Signed in as <strong>{session?.user.email ?? 'your account'}</strong>. The record
            belongs to this login, so signing in with the same email and password on another device
            picks up where you left off.
          </p>
          {signOutError && <Alert>{signOutError}</Alert>}
          <div className="row-actions">
            <button
              type="button"
              className="button button--ghost"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
            >
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
          <p className="muted small">
            Signing out clears the offline copy from this browser. Anything already saved to your
            Supabase database stays there.
          </p>
        </Card>
        <Card>
          <header className="card-head">
            <h2>Intervals</h2>
            {dirty && <span className="muted small">Unsaved changes</span>}
          </header>

          <form className="form" onSubmit={handleSubmit}>
            {error && <Alert>{error}</Alert>}
            {notice && <Alert tone="ok">{notice}</Alert>}

            <div className="field-grid">
              <Field
                label="New system life (days)"
                htmlFor="new-system-days"
                hint="How long a new system should last before replacement."
              >
                <input
                  id="new-system-days"
                  type="number"
                  min={1}
                  max={730}
                  step={1}
                  required
                  value={form.newSystemIntervalDays}
                  onChange={(event) =>
                    update('newSystemIntervalDays', Number(event.target.value))
                  }
                />
              </Field>

              <Field
                label="Re-fit every (days)"
                htmlFor="refit-days"
                hint="Planned gap between re-fits while a system is in use."
              >
                <input
                  id="refit-days"
                  type="number"
                  min={1}
                  max={365}
                  step={1}
                  required
                  value={form.refitIntervalDays}
                  onChange={(event) => update('refitIntervalDays', Number(event.target.value))}
                />
              </Field>

              <Field
                label="Stylist lead time (days)"
                htmlFor="stylist-lead"
                hint="How early the system must reach your stylist."
              >
                <input
                  id="stylist-lead"
                  type="number"
                  min={0}
                  max={365}
                  step={1}
                  required
                  value={form.stylistLeadDays}
                  onChange={(event) => update('stylistLeadDays', Number(event.target.value))}
                />
              </Field>

              <Field
                label="Order lead time (days)"
                htmlFor="order-lead"
                hint="How early to order before the stylist date."
              >
                <input
                  id="order-lead"
                  type="number"
                  min={0}
                  max={365}
                  step={1}
                  required
                  value={form.orderLeadDays}
                  onChange={(event) => update('orderLeadDays', Number(event.target.value))}
                />
              </Field>
            </div>

            <Field label="Currency" htmlFor="currency" hint="Used for every cost in the app.">
              <select
                id="currency"
                value={form.currency}
                onChange={(event) => update('currency', event.target.value)}
              >
                {CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </Field>

            <p className="muted small">
              A system fitted on 1 Jan 2026 would be ordered by {formatDate(sampleOrder)}, with the
              stylist by {formatDate(sampleStylist)} and replaced on {formatDate(sampleDue)}.
            </p>

            <div className="modal-actions">
              <button
                type="submit"
                className="button button--primary"
                disabled={saving || !dirty || offlineSnapshot}
              >
                {saving ? 'Saving…' : 'Save settings'}
              </button>
            </div>
          </form>
        </Card>
        <Card>
          <header className="card-head">
            <h2>Your data</h2>
          </header>
          <p className="muted small">
            Everything lives in your Supabase database. Download a JSON copy any time — the app
            also keeps the last sync on this device, so it still opens offline, read-only.
          </p>
          <div className="row-actions">
            <button
              type="button"
              className="button"
              onClick={handleExport}
              disabled={data.fittings.length === 0 && data.costs.length === 0}
            >
              Export JSON
            </button>
            <button
              type="button"
              className="button button--ghost"
              onClick={() => void refresh()}
              disabled={offlineSnapshot}
            >
              Refresh from server
            </button>
          </div>
        </Card>

        <Card className="card--soft">
          <header className="card-head">
            <h2>About</h2>
          </header>
          <p className="muted small">
            Hair Tracker keeps a record of system fittings, re-fits and spend. On iPhone or Android,
            open it in the browser and choose <em>Add to Home Screen</em> to install it. Wear days
            are counted inclusively, and days with no system on are never counted as wear.
          </p>
        </Card>
      </div>
    </DataGate>
  )
}
