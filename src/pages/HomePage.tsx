import { useState } from 'react'
import type { Tab } from '../App'
import { useAppData } from '../state/AppDataContext'
import { Badge, Card, EmptyState, StatTile, type Tone } from '../components/ui'
import { DataGate } from '../components/DataGate'
import { OfflineNotice } from '../components/OfflineNotice'
import { FittingModal } from '../components/FittingModal'
import { RemoveModal } from '../components/RemoveModal'
import {
  KIND_LABELS,
  averageMonthlyCost,
  averageWearDays,
  computeSchedule,
  costPerWornDay,
  totalDaysWorn,
  type Schedule,
} from '../lib/calc'
import {
  countdownLabel,
  daysBetween,
  formatDate,
  formatDays,
  formatMoney,
  isoYear,
  todayISO,
} from '../lib/dates'

interface Step {
  key: string
  label: string
  date: string
  hint: string
}

interface HeroCopy {
  eyebrow: string
  title: string
  body: string
  tone: Tone
}

/** The hero is about the session on your head: how long it has been on and when it's due a re-fit. */
function describeRefit(
  schedule: Schedule,
  refitIntervalDays: number,
  todayIso: string,
): HeroCopy {
  const current = schedule.current
  const due = schedule.refitDueOn

  if (!current || !due) {
    return {
      eyebrow: 'Nothing on',
      title: 'No system on right now',
      body: `Mark a system as fitted to start the wear clock. Re-fits fall due every ${refitIntervalDays} days while it's on.`,
      tone: 'accent',
    }
  }

  const daysToRefit = daysBetween(todayIso, due)
  const worn = formatDays(schedule.currentDaysWorn)
  const onSince = formatDate(current.fittedOn)

  if (daysToRefit < 0) {
    return {
      eyebrow: 'Re-fit overdue',
      title: `Re-fit was due ${formatDate(due)}`,
      body: `${worn} worn since ${onSince}, so it slipped by ${formatDays(-daysToRefit)}. Book the stylist and log the re-fit once it's back on.`,
      tone: 'danger',
    }
  }

  if (daysToRefit === 0) {
    return {
      eyebrow: 'Re-fit due today',
      title: 'Re-fit due today',
      body: `${worn} worn since ${onSince}. Log the re-fit once it's back on to restart the clock.`,
      tone: 'warn',
    }
  }

  if (daysToRefit <= 7) {
    return {
      eyebrow: 'Re-fit soon',
      title: `Re-fit due ${formatDate(due)}`,
      body: `${countdownLabel(due, todayIso)} — ${worn} worn since ${onSince}. Get it booked in with your stylist.`,
      tone: 'warn',
    }
  }

  return {
    eyebrow: 'Re-fit due',
    title: `Next re-fit ${formatDate(due)}`,
    body: `${countdownLabel(due, todayIso)} — ${worn} worn so far since ${onSince}.`,
    tone: 'ok',
  }
}

/** The current-system card is about the system itself: when it was fitted and when it must be replaced. */
function describeSchedule(schedule: Schedule, todayIso: string): HeroCopy {
  if (schedule.phase === 'no-system') {
    return {
      eyebrow: 'Getting started',
      title: 'Log your first system',
      body: 'Add the day your current system went on. From then on we count wear days, flag re-fits and work out when to order the next one.',
      tone: 'accent',
    }
  }

  const due = schedule.systemDueOn as string

  if (schedule.phase === 'due') {
    return {
      eyebrow: 'Replacement due',
      title: `New system needed — ${countdownLabel(due, todayIso).toLowerCase()}`,
      body: `Your system has reached its planned life (${formatDate(due)}). Order the replacement and book the stylist.`,
      tone: 'danger',
    }
  }

  if (schedule.phase === 'stylist') {
    return {
      eyebrow: 'Stylist time',
      title: `Get it to the stylist by ${formatDate(schedule.stylistByOn as string)}`,
      body: `${countdownLabel(schedule.stylistByOn as string, todayIso)} to hand over the new system — the replacement is due ${formatDate(due)}.`,
      tone: 'warn',
    }
  }

  if (schedule.phase === 'order') {
    return {
      eyebrow: 'Time to order',
      title: `Order a new system by ${formatDate(schedule.orderByOn as string)}`,
      body: `${countdownLabel(schedule.orderByOn as string, todayIso)} to order, so it arrives in time for the stylist and the ${formatDate(due)} fitting.`,
      tone: 'warn',
    }
  }

  return {
    eyebrow: 'All sorted',
    title: `Next system due ${formatDate(due)}`,
    body: `${countdownLabel(due, todayIso)}. Order by ${formatDate(schedule.orderByOn as string)} and book the stylist by ${formatDate(schedule.stylistByOn as string)}.`,
    tone: 'ok',
  }
}

export default function HomePage({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const { data, offlineSnapshot } = useAppData()
  const [modal, setModal] = useState<'log' | 'remove' | null>(null)

  const today = todayISO()
  const currency = data.settings.currency
  const schedule = computeSchedule(data.fittings, data.settings, today)
  const current = schedule.current
  const hero = describeRefit(schedule, data.settings.refitIntervalDays, today)
  const systemCopy = describeSchedule(schedule, today)

  const year = isoYear(today)
  const yearEntries = data.costs.filter((cost) => isoYear(cost.spentOn) === year)
  const yearSpend = yearEntries.reduce((total, cost) => total + cost.amountMinor, 0)
  const allSpend = data.costs.reduce((total, cost) => total + cost.amountMinor, 0)
  const wornDays = totalDaysWorn(data.fittings, today)
  const perDay = costPerWornDay(allSpend, wornDays)
  const averageSession = averageWearDays(data.fittings, today)
  const monthlyCost = averageMonthlyCost(data.costs, today)

  const steps: Step[] = []
  if (schedule.orderByOn) {
    steps.push({
      key: 'order',
      label: 'Order the new system',
      date: schedule.orderByOn,
      hint: 'Allow time for delivery to your stylist',
    })
  }
  if (schedule.stylistByOn) {
    steps.push({
      key: 'stylist',
      label: 'Drop it with the stylist',
      date: schedule.stylistByOn,
      hint: 'Leaves time for the cut-in',
    })
  }
  if (schedule.systemDueOn) {
    steps.push({
      key: 'system',
      label: 'New system due',
      date: schedule.systemDueOn,
      hint: `${data.settings.newSystemIntervalDays} days after the last new system`,
    })
  }
  if (schedule.refitDueOn) {
    steps.push({
      key: 'refit',
      label: 'Re-fit due',
      date: schedule.refitDueOn,
      hint: `Every ${data.settings.refitIntervalDays} days while worn`,
    })
  }
  steps.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  return (
    <DataGate>
      <div className="page">
        <OfflineNotice />

        <Card className={`hero hero--${hero.tone}`}>
          <div className="hero-head">
            <span className="hero-eyebrow">{hero.eyebrow}</span>
            {current && (
              <Badge tone={current.kind === 'new-system' ? 'accent' : 'neutral'}>
                {KIND_LABELS[current.kind]}
              </Badge>
            )}
          </div>
          <h1 className="hero-title">{hero.title}</h1>
          <p className="hero-body">{hero.body}</p>
          {current && schedule.refitDueOn && (
            <div className="stat-row hero-stats">
              <StatTile label="On since" value={formatDate(current.fittedOn)} />
              <StatTile label="Days worn" value={schedule.currentDaysWorn} hint="Including today" />
              <StatTile
                label="Re-fit due"
                value={formatDate(schedule.refitDueOn)}
                hint={countdownLabel(schedule.refitDueOn, today)}
                tone={schedule.refitOverdue ? 'danger' : undefined}
              />
            </div>
          )}
          {current?.comments && <p className="note">{current.comments}</p>}
          <div className="hero-actions">
            <button
              type="button"
              className="button button--primary"
              onClick={() => setModal('log')}
              disabled={offlineSnapshot}
            >
              Log a fitting
            </button>
            {current && (
              <button
                type="button"
                className="button button--ghost"
                onClick={() => setModal('remove')}
                disabled={offlineSnapshot}
              >
                Mark as removed
              </button>
            )}
          </div>
        </Card>

        {data.fittings.length === 0 ? (
          <Card>
            <EmptyState
              title="Nothing logged yet"
              description="Start with the day your current system went on — everything else builds from there."
              action={
                <button
                  type="button"
                  className="button button--primary"
                  onClick={() => setModal('log')}
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
              <header className="card-head">
                <h2>Next steps</h2>
                <span className="muted small">
                  {data.settings.newSystemIntervalDays}-day system life
                </span>
              </header>
              <ol className="timeline">
                {steps.map((step) => {
                  const overdue = step.date < today
                  const isToday = step.date === today
                  return (
                    <li
                      key={step.key}
                      className={`timeline-item${overdue ? ' is-overdue' : ''}${
                        isToday ? ' is-today' : ''
                      }`}
                    >
                      <span className="timeline-dot" aria-hidden="true" />
                      <div className="timeline-body">
                        <span className="timeline-label">{step.label}</span>
                        <span className="timeline-hint">{step.hint}</span>
                      </div>
                      <div className="timeline-date">
                        <span>{formatDate(step.date)}</span>
                        <Badge tone={overdue ? 'danger' : isToday ? 'accent' : 'neutral'}>
                          {countdownLabel(step.date, today)}
                        </Badge>
                      </div>
                    </li>
                  )
                })}
              </ol>
            </Card>
            <Card>
              <header className="card-head">
                <h2>{schedule.systemFitting ? 'Current system' : 'No system logged'}</h2>
                <span className="muted small">{current ? 'On now' : 'Off right now'}</span>
              </header>

              <div className={`card-lead card-lead--${systemCopy.tone}`}>
                <span className="card-lead-eyebrow">{systemCopy.eyebrow}</span>
                <p className="card-lead-title">{systemCopy.title}</p>
                <p className="card-lead-body">{systemCopy.body}</p>
              </div>

              {schedule.systemFitting &&
                schedule.systemDueOn &&
                schedule.orderByOn &&
                schedule.stylistByOn && (
                  <div className="stat-row">
                    <StatTile
                      label="Fitted"
                      value={formatDate(schedule.systemFitting.fittedOn)}
                      hint={countdownLabel(schedule.systemFitting.fittedOn, today)}
                    />
                    <StatTile
                      label="New system due"
                      value={formatDate(schedule.systemDueOn)}
                      hint={countdownLabel(schedule.systemDueOn, today)}
                      tone={schedule.phase === 'due' ? 'danger' : undefined}
                    />
                    <StatTile
                      label="Order by"
                      value={formatDate(schedule.orderByOn)}
                      hint={countdownLabel(schedule.orderByOn, today)}
                    />
                    <StatTile
                      label="Stylist by"
                      value={formatDate(schedule.stylistByOn)}
                      hint={countdownLabel(schedule.stylistByOn, today)}
                    />
                  </div>
                )}
            </Card>

            <Card>
              <header className="card-head">
                <h2>At a glance</h2>
                <button type="button" className="link" onClick={() => onNavigate('costs')}>
                  See costs
                </button>
              </header>
              <div className="stat-row">
                <StatTile
                  label={`Spent in ${year}`}
                  value={formatMoney(yearSpend, currency)}
                  hint={`${yearEntries.length} ${yearEntries.length === 1 ? 'entry' : 'entries'}`}
                />
                <StatTile
                  label="Cost per day worn"
                  value={perDay === null ? '—' : formatMoney(perDay, currency)}
                />
                <StatTile
                  label="Average session"
                  value={averageSession === null ? '—' : formatDays(averageSession)}
                />
                <StatTile
                  label="Average monthly cost"
                  value={monthlyCost === null ? '—' : formatMoney(monthlyCost.perMonthMinor, currency)}
                  hint={
                    monthlyCost === null
                      ? undefined
                      : `since ${formatDate(monthlyCost.from, 'MMM yyyy')}`
                  }
                />
              </div>
            </Card>
          </>
        )}

        <Card className="card--soft">
          <header className="card-head">
            <h2>How the dates work</h2>
          </header>
          <p className="muted small">
            The replacement countdown runs from the day your last <em>new</em> system went on, so
            days when it was off don't push it back. Wear days are counted inclusively — the day it
            goes on and the day it comes off both count.
          </p>
        </Card>
      </div>

      {modal === 'log' && <FittingModal onClose={() => setModal(null)} />}
      {modal === 'remove' && current && (
        <RemoveModal fitting={current} onClose={() => setModal(null)} />
      )}
    </DataGate>
  )
}
