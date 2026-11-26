import { useState, type FormEvent } from 'react'
import { Modal } from './Modal'
import { Alert, Field } from './ui'
import { useAppData } from '../state/AppDataContext'
import { CATEGORY_LABELS, COST_CATEGORIES } from '../lib/calc'
import { currencySymbol, formatMoneyInput, parseMoneyToMinor, todayISO } from '../lib/dates'
import type { CostCategory, CostEntry } from '../types'

export function CostModal({ onClose, editing }: { onClose: () => void; editing?: CostEntry }) {
  const { data, saveCost } = useAppData()
  const symbol = currencySymbol(data.settings.currency)

  const [category, setCategory] = useState<CostCategory>(editing?.category ?? 'styling')
  const [amount, setAmount] = useState(editing ? formatMoneyInput(editing.amountMinor) : '')
  const [spentOn, setSpentOn] = useState(editing?.spentOn ?? todayISO())
  const [note, setNote] = useState(editing?.note ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const amountMinor = parseMoneyToMinor(amount)
    if (amountMinor === null || amountMinor <= 0) {
      setError('Enter an amount like 12.50.')
      return
    }
    if (!spentOn) {
      setError('Pick the date you paid.')
      return
    }

    setBusy(true)
    try {
      await saveCost({ spentOn, category, amountMinor, note: note.trim() }, editing?.id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this entry.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? 'Edit cost' : 'Add a cost'}
      description="Amounts are stored to the penny, so yearly totals add up exactly."
    >
      <form className="form" onSubmit={handleSubmit}>
        {error && <Alert>{error}</Alert>}

        <div className="field">
          <span className="field-label">What was it for?</span>
          <div className="segmented segmented--wrap" role="group" aria-label="Cost category">
            {COST_CATEGORIES.map((option) => (
              <button
                key={option}
                type="button"
                className={category === option ? 'is-active' : ''}
                onClick={() => setCategory(option)}
              >
                {CATEGORY_LABELS[option]}
              </button>
            ))}
          </div>
        </div>

        <div className="field-grid">
          <Field label="Amount" htmlFor="amount">
            <div className="money-input">
              <span aria-hidden="true">{symbol}</span>
              <input
                id="amount"
                inputMode="decimal"
                autoComplete="off"
                required
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
              />
            </div>
          </Field>

          <Field label="Paid on" htmlFor="spent-on">
            <input
              id="spent-on"
              type="date"
              required
              value={spentOn}
              onChange={(event) => setSpentOn(event.target.value)}
            />
          </Field>
        </div>

        <Field label="Note" htmlFor="cost-note">
          <input
            id="cost-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Stylist, salon, colour…"
          />
        </Field>

        <div className="modal-actions">
          <button type="button" className="button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="button button--primary" disabled={busy}>
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Add cost'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
