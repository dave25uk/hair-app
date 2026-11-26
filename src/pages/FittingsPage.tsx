import { useMemo, useState } from 'react'
import { useAppData } from '../state/AppDataContext'
import { Badge, Card, EmptyState, StatTile } from '../components/ui'
import { DataGate } from '../components/DataGate'
import { OfflineNotice } from '../components/OfflineNotice'
import { FittingModal } from '../components/FittingModal'
import { ConfirmModal, RemoveModal } from '../components/RemoveModal'
import {
  KIND_LABELS,
  averageWearDays,
  daysOffBetween,
  daysWorn,
  sortFittings,
  totalDaysWorn,
} from '../lib/calc'
import { formatDate, formatDays, todayISO } from '../lib/dates'
import type { Fitting } from '../types'

interface SessionView {
  fitting: Fitting
  days: number
  gapBefore: number
}

export default function FittingsPage() {
  const { data, offlineSnapshot, deleteFitting } = useAppData()
  const [logging, setLogging] = useState(false)
  const [editing, setEditing] = useState<Fitting | null>(null)
  const [removing, setRemoving] = useState<Fitting | null>(null)
  const [deleting, setDeleting] = useState<Fitting | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const today = todayISO()

  const sessions = useMemo<SessionView[]>(() => {
    const ordered = sortFittings(data.fittings)
    return ordered
      .map((fitting, index) => ({
        fitting,
        days: daysWorn(fitting, today),
        gapBefore: index === 0 ? 0 : daysOffBetween(ordered[index - 1], fitting),
      }))
      .reverse()
  }, [data.fittings, today])

  const totalWorn = totalDaysWorn(data.fittings, today)
  const averageRefit = averageWearDays(data.fittings, today, 'refit')
  const onNow = sessions.find((session) => session.fitting.removedOn === null) ?? null

  async function handleDelete() {
    if (!deleting) return
    setBusy(true)
    setError(null)
    try {
      await deleteFitting(deleting.id)
      setDeleting(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the fitting.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <DataGate>
      <div className="page">
        <OfflineNotice />

        <header className="page-head">
          <div>
            <h1>Fittings</h1>
            <p className="muted">
              Every time a system goes on or comes off, with the gap days in between.
            </p>
          </div>
          <button
            type="button"
            className="button button--primary"
            onClick={() => setLogging(true)}
            disabled={offlineSnapshot}
          >
            Log a fitting
          </button>
        </header>

        {error && <p className="alert alert--danger">{error}</p>}

        {data.fittings.length === 0 ? (
          <Card>
            <EmptyState
              title="No fittings yet"
              description="Log the day your system went on. Earlier fittings can be added later — they sort into place automatically."
              action={
                <button
                  type="button"
                  className="button button--primary"
                  onClick={() => setLogging(true)}
                  disabled={offlineSnapshot}
                >
                  Log your first fitting
                </button>
              }
            />
          </Card>
        ) : (
          <>
            <Card>
              <div className="stat-row">
                <StatTile label="Sessions" value={data.fittings.length} />
                <StatTile
                  label="Days worn"
                  value={totalWorn}
                  hint={
                    onNow ? `${formatDays(onNow.days)} in the current session` : 'Nothing on now'
                  }
                />
                <StatTile
                  label="Average re-fit"
                  value={averageRefit === null ? '—' : formatDays(averageRefit)}
                  hint="Across re-fit sessions"
                />
              </div>
            </Card>
            <ol className="sessions">
              {sessions.map(({ fitting, days, gapBefore }) => {
                const isOpen = fitting.removedOn === null
                return (
                  <li key={fitting.id} className={`session${isOpen ? ' is-open' : ''}`}>
                    <div className="session-rail" aria-hidden="true">
                      <span className="session-dot" />
                    </div>
                    <Card as="article" className="session-card">
                      <header className="session-head">
                        <div className="session-tags">
                          <Badge tone={fitting.kind === 'new-system' ? 'accent' : 'neutral'}>
                            {KIND_LABELS[fitting.kind]}
                          </Badge>
                          {isOpen && <Badge tone="ok">On now</Badge>}
                          {gapBefore > 0 && <Badge tone="warn">{formatDays(gapBefore)} off</Badge>}
                        </div>
                        <span className="session-date">{formatDate(fitting.fittedOn)}</span>
                      </header>

                      <p className="session-worn">
                        {isOpen ? 'Worn since, ' : 'Worn '}
                        {formatDays(days)}
                        {fitting.removedOn
                          ? ` · ${formatDate(fitting.fittedOn, 'd MMM')} → ${formatDate(fitting.removedOn, 'd MMM yyyy')}`
                          : ' · still on'}
                      </p>

                      {fitting.comments && <p className="note">{fitting.comments}</p>}

                      <div className="row-actions">
                        <button
                          type="button"
                          className="link"
                          onClick={() => setEditing(fitting)}
                          disabled={offlineSnapshot}
                        >
                          Edit
                        </button>
                        {isOpen && (
                          <button
                            type="button"
                            className="link"
                            onClick={() => setRemoving(fitting)}
                            disabled={offlineSnapshot}
                          >
                            Mark as removed
                          </button>
                        )}
                        <button
                          type="button"
                          className="link link--danger"
                          onClick={() => setDeleting(fitting)}
                          disabled={offlineSnapshot}
                        >
                          Delete
                        </button>
                      </div>
                    </Card>
                  </li>
                )
              })}
            </ol>
          </>
        )}
      </div>

      {logging && <FittingModal onClose={() => setLogging(false)} />}
      {editing && <FittingModal editing={editing} onClose={() => setEditing(null)} />}
      {removing && <RemoveModal fitting={removing} onClose={() => setRemoving(null)} />}
      {deleting && (
        <ConfirmModal
          title="Delete this fitting?"
          message={`${KIND_LABELS[deleting.kind]} from ${formatDate(deleting.fittedOn)} will be removed from your history. This cannot be undone.`}
          confirmLabel="Delete fitting"
          busy={busy}
          onCancel={() => setDeleting(null)}
          onConfirm={() => void handleDelete()}
        />
      )}
    </DataGate>
  )
}
