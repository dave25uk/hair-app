import { useState, type FormEvent } from 'react'
import { Modal } from './Modal'
import { Alert, Field } from './ui'
import { useAppData } from '../state/AppDataContext'
import { formatDate, todayISO } from '../lib/dates'
import type { Fitting } from '../types'

interface RemoveModalProps {
  fitting: Fitting
  onClose: () => void
}

export function RemoveModal({ fitting, onClose }: RemoveModalProps) {
  const { markRemoved } = useAppData()
  const [removedOn, setRemovedOn] = useState(todayISO())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    if (!removedOn) {
      setError('Pick the day it came off.')
      return
    }
    if (removedOn < fitting.fittedOn) {
      setError('The system cannot come off before it went on.')
      return
    }
    setBusy(true)
    try {
      await markRemoved(fitting.id, removedOn)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the fitting.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Mark as removed"
      description={`Fitted ${formatDate(fitting.fittedOn)}. Days after this date won't count as wear until you log the next fitting.`}
    >
      <form className="form" onSubmit={handleSubmit}>
        {error && <Alert>{error}</Alert>}
        <Field label="Came off on" htmlFor="removed-on">
          <input
            id="removed-on"
            type="date"
            required
            min={fitting.fittedOn}
            value={removedOn}
            onChange={(event) => setRemovedOn(event.target.value)}
          />
        </Field>
        <div className="modal-actions">
          <button type="button" className="button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="button button--primary" disabled={busy}>
            {busy ? 'Saving…' : 'Mark as removed'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

interface ConfirmModalProps {
  title: string
  message: string
  confirmLabel?: string
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  title,
  message,
  confirmLabel = 'Delete',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <Modal open onClose={onCancel} title={title}>
      <div className="form">
        <p>{message}</p>
        <div className="modal-actions">
          <button type="button" className="button" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="button button--danger"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}
