import { useMemo, useState } from 'react'
import { useAppData } from '../state/AppDataContext'
import { Badge, Card, StatTile, type Tone } from '../components/ui'
import { DataGate } from '../components/DataGate'
import { OfflineNotice } from '../components/OfflineNotice'
import { CostModal } from '../components/CostModal'
import { ConfirmModal } from '../components/RemoveModal'
import {
  CATEGORY_LABELS,
  COST_CATEGORIES,
  availableYears,
  costPerWornDay,
  costsByCategory,
  monthlyTotals,
  sumCosts,
  totalDaysWorn,
} from '../lib/calc'
import { formatDate, formatMoney, isoYear, todayISO } from '../lib/dates'
import type { CostCategory, CostEntry } from '../types'

const CATEGORY_TONE: Record<CostCategory, Tone> = {
  system: 'accent',
  styling: 'ok',
  fitting: 'warn',
}

export default function CostsPage() {
  const { data, offlineSnapshot, deleteCost } = useAppData()
  const today = todayISO()
  const currentYear = isoYear(today)

  const [year, setYear] = useState(currentYear)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<CostEntry | null>(null)
  const [deleting, setDeleting] = useState<CostEntry | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currency = data.settings.currency

  const years = useMemo(() => {
    const unique = new Set<number>(availableYears(data.costs))
    unique.add(currentYear)
    return [...unique].sort((a, b) => b - a)
  }, [data.costs, currentYear])

  const yearEntries = useMemo(
    () =>
      data.costs
        .filter((cost) => isoYear(cost.spentOn) === year)
        .sort((a, b) =>
          a.spentOn === b.spentOn
            ? a.createdAt < b.createdAt
              ? 1
              : -1
            : a.spentOn < b.spentOn
              ? 1
              : -1,
        ),
    [data.costs, year],
  )
  const yearTotal = sumCosts(yearEntries)
  const byCategory = costsByCategory(yearEntries)
  const months = monthlyTotals(data.costs, year)
  const peakMonth = Math.max(...months.map((month) => month.totalMinor), 1)

  const allSpend = sumCosts(data.costs)
  const wornDays = totalDaysWorn(data.fittings, today)
  const perDay = costPerWornDay(allSpend, wornDays)

  function barHeight(value: number): number {
    if (value <= 0) return 0
    return Math.max(6, Math.round((value / peakMonth) * 100))
  }

  async function handleDelete() {
    if (!deleting) return
    setBusy(true)
    setError(null)
    try {
      await deleteCost(deleting.id)
      setDeleting(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete this entry.')
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
            <h1>Costs</h1>
            <p className="muted">What you have spent, by month and category.</p>
          </div>
          <button
            type="button"
            className="button button--primary"
            onClick={() => setAdding(true)}
            disabled={offlineSnapshot}
          >
            Add a cost
          </button>
        </header>

        {error && <p className="alert alert--danger">{error}</p>}

        <Card>
          <div className="year-bar">
            <label htmlFor="cost-year">Year</label>
            <select
              id="cost-year"
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
            >
              {years.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="stat-row">
            <StatTile
              label={`Total ${year}`}
              value={formatMoney(yearTotal, currency)}
              hint={`${yearEntries.length} ${yearEntries.length === 1 ? 'entry' : 'entries'}`}
            />
            {COST_CATEGORIES.map((category) => (
              <StatTile
                key={category}
                label={CATEGORY_LABELS[category]}
                value={formatMoney(byCategory[category], currency)}
              />
            ))}
          </div>
        </Card>

        <Card>
          <header className="card-head">
            <h2>Month by month</h2>
            <span className="muted small">{formatMoney(yearTotal, currency)} in {year}</span>
          </header>
          <ol className="chart">
            {months.map((month) => (
              <li
                key={month.month}
                className={month.totalMinor > 0 ? 'chart-col has-value' : 'chart-col'}
                title={`${month.label} ${year}: ${formatMoney(month.totalMinor, currency)}`}
              >
                <span className="chart-bar" style={{ height: `${barHeight(month.totalMinor)}%` }} />
                <span className="chart-label">{month.label}</span>
              </li>
            ))}
          </ol>
        </Card>

        <Card>
          <header className="card-head">
            <h2>Cost per day worn</h2>
          </header>
          <div className="stat-row">
            <StatTile label="All-time spend" value={formatMoney(allSpend, currency)} />
            <StatTile label="Days worn" value={wornDays} />
            <StatTile
              label="Per day worn"
              value={perDay === null ? '—' : formatMoney(perDay, currency)}
              hint={perDay === null ? 'Log a fitting first' : 'Across every session'}
            />
          </div>
        </Card>
        <Card>
          <header className="card-head">
            <h2>Entries in {year}</h2>
            {yearEntries.length > 0 && (
              <span className="muted small">Newest first</span>
            )}
          </header>

          {yearEntries.length === 0 ? (
            <p className="muted">
              Nothing logged for {year} yet.{' '}
              <button
                type="button"
                className="link"
                onClick={() => setAdding(true)}
                disabled={offlineSnapshot}
              >
                Add the first one
              </button>
            </p>
          ) : (
            <ul className="cost-list">
              {yearEntries.map((entry) => (
                <li key={entry.id} className="cost-row">
                  <div className="cost-main">
                    <Badge tone={CATEGORY_TONE[entry.category]}>
                      {CATEGORY_LABELS[entry.category]}
                    </Badge>
                    <div>
                      <p className="cost-note">
                        {entry.note || CATEGORY_LABELS[entry.category]}
                      </p>
                      <p className="muted small">{formatDate(entry.spentOn)}</p>
                    </div>
                  </div>
                  <div className="cost-side">
                    <span className="cost-amount">
                      {formatMoney(entry.amountMinor, currency)}
                    </span>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="link"
                        onClick={() => setEditing(entry)}
                        disabled={offlineSnapshot}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="link link--danger"
                        onClick={() => setDeleting(entry)}
                        disabled={offlineSnapshot}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {adding && <CostModal onClose={() => setAdding(false)} />}
      {editing && <CostModal editing={editing} onClose={() => setEditing(null)} />}
      {deleting && (
        <ConfirmModal
          title="Delete this cost?"
          message={`${formatMoney(deleting.amountMinor, currency)} on ${formatDate(deleting.spentOn)} will be removed. This cannot be undone.`}
          confirmLabel="Delete cost"
          busy={busy}
          onCancel={() => setDeleting(null)}
          onConfirm={() => void handleDelete()}
        />
      )}
    </DataGate>
  )
}
