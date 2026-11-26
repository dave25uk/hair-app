import { useState, type FormEvent } from 'react'
import { Modal } from './Modal'
import { Alert, Field } from './ui'
import { useAppData } from '../state/AppDataContext'
import { currentFitting } from '../lib/calc'
import { daysInclusive, formatDays, todayISO } from '../lib/dates'
import type { Fitting, FittingKind } from '../types'

interface FittingModalProps {
  onClose: () => void
  /** Provided when editing an existing session instead of logging a new one. */
  editing?: Fitting
}

export function FittingModal({ onClose, editing }: FittingModalProps) {
  const { data, logFitting, updateFitting } = useAppData()
  const openSession = editing ? null : currentFitting(data.fittings)

  const [kind, setKind] = useState<FittingKind>(editing?.kind ?? 'refit')
  const [fittedOn, setFittedOn] = useState(editing?.fittedOn ?? todayISO())
  const [previousRemovedOn, setPreviousRemovedOn] = useState(
    openSession?.fittedOn ?? todayISO(),
  )
  const [previousTouched, setPreviousTouched] = useState(false)
  const [removedOn, setRemovedOn] = useState(editing?.removedOn ?? '')
  const [comments, setComments] = useState(editing?.comments ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const previewDays = removedOn && fittedOn ? daysInclusive(fittedOn, removedOn) : null

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!fittedOn) {
      setError('Pick the day the system went on.')
      return
    }
    if (editing && removedOn && removedOn < fittedOn) {
      setError('The system cannot come off before it went on.')
      return
    }
    if (!editing && openSession && previousRemovedOn) {
      if (previousRemovedOn > fittedOn) {
        setError('The old system cannot come off after the new one goes on.')
        return
      }
      if (previousRemovedOn < openSession.fittedOn) {
        setError(
          `The current system went on ${openSession.fittedOn} — it cannot come off before that.`,
        )
        return
      }
    }

    setBusy(true)
    try {
      if (editing) {
        await updateFitting({
          ...editing,
          kind,
          fittedOn,
          removedOn: removedOn || null,
          comments: comments.trim(),
        })
      } else {
        await logFitting({
          kind,
          fittedOn,
          previousRemovedOn: openSession && previousRemovedOn ? previousRemovedOn : null,
          comments: comments.trim(),
        })
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the fitting.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? 'Edit fitting' : 'Log a fitting'}
      description={
        editing
          ? 'Correct the dates or notes for this session.'
          : 'Dates count inclusively: the day it went on and the day it came off both count.'
      }
    >
      <form className="form" onSubmit={handleSubmit}>
        {error && <Alert>{error}</Alert>}

        <div className="field">
          <span className="field-label">What happened?</span>
          <div className="segmented" role="group" aria-label="Fitting type">
            <button
              type="button"
              className={kind === 'new-system' ? 'is-active' : ''}
              onClick={() => setKind('new-system')}
              disabled={Boolean(editing)}
            >
              New system
            </button>
            <button
              type="button"
              className={kind === 'refit' ? 'is-active' : ''}
              onClick={() => setKind('refit')}
              disabled={Boolean(editing)}
            >
              Re-fit
            </button>
          </div>
          <p className="field-hint">
            {kind === 'new-system'
              ? 'A brand new system went on — this resets the replacement countdown.'
              : 'The same system was taken off and put back on.'}
          </p>
        </div>

        <Field label="Fitted on" htmlFor="fitted-on">
          <input
            id="fitted-on"
            type="date"
            required
            value={fittedOn}
            onChange={(event) => {
              const next = event.target.value
              setFittedOn(next)
              if (!previousTouched && next) setPreviousRemovedOn(next)
            }}
          />
        </Field>

        {!editing && openSession && (
          <Field
            label="Previous system came off"
            htmlFor="previous-removed-on"
            hint="Leave this on the same day for a straight swap. Any days in between are a gap, not wear."
          >
            <input
              id="previous-removed-on"
              type="date"
              min={openSession.fittedOn}
              max={fittedOn}
              value={previousRemovedOn}
              onChange={(event) => {
                setPreviousTouched(true)
                setPreviousRemovedOn(event.target.value)
              }}
            />
          </Field>
        )}

        {editing && (
          <Field
            label="Taken off on"
            htmlFor="removed-on"
            hint="Leave empty if this system is still being worn today."
          >
            <input
              id="removed-on"
              type="date"
              min={fittedOn}
              value={removedOn}
              onChange={(event) => setRemovedOn(event.target.value)}
            />
          </Field>
        )}

        {editing && previewDays !== null && (
          <p className="muted small">This session would be {formatDays(previewDays)}.</p>
        )}

        <Field label="Notes" htmlFor="comments">
          <textarea
            id="comments"
            rows={3}
            value={comments}
            onChange={(event) => setComments(event.target.value)}
            placeholder="Stylist, colour, how it felt…"
          />
        </Field>

        <div className="modal-actions">
          <button type="button" className="button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="button button--primary" disabled={busy}>
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Log fitting'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
