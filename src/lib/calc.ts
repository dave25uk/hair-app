import type { CostCategory, CostEntry, Fitting, FittingKind, Settings } from '../types'
import { addDaysISO, daysBetween, daysInclusive, monthsInclusive } from './dates'

export const COST_CATEGORIES = ['system', 'styling', 'fitting'] as const

export const CATEGORY_LABELS: Record<CostCategory, string> = {
  system: 'Hair systems',
  styling: 'Styling',
  fitting: 'Fitting',
}

export const KIND_LABELS: Record<FittingKind, string> = {
  'new-system': 'New system',
  refit: 'Re-fit',
}

export type SchedulePhase = 'no-system' | 'ok' | 'order' | 'stylist' | 'due'

export interface Schedule {
  /** Session currently being worn (system is on), if any. */
  current: Fitting | null
  currentDaysWorn: number
  refitDueOn: string | null
  refitOverdue: boolean
  /** The most recently fitted *new* system — its age drives the replacement dates. */
  systemFitting: Fitting | null
  systemDueOn: string | null
  stylistByOn: string | null
  orderByOn: string | null
  phase: SchedulePhase
}

export function byFittedOnAsc(a: Fitting, b: Fitting): number {
  if (a.fittedOn !== b.fittedOn) return a.fittedOn < b.fittedOn ? -1 : 1
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1
  return 0
}

export function sortFittings(fittings: Fitting[]): Fitting[] {
  return [...fittings].sort(byFittedOnAsc)
}

export function currentFitting(fittings: Fitting[]): Fitting | null {
  const open = fittings.filter((fitting) => fitting.removedOn === null)
  if (open.length === 0) return null
  return sortFittings(open).at(-1) ?? null
}

/** Days worn for a session, counting the day it went on and the day it came off. */
export function daysWorn(fitting: Fitting, todayIso: string): number {
  const end = fitting.removedOn ?? todayIso
  const days = daysInclusive(fitting.fittedOn, end)
  return days > 0 ? days : 0
}

/** Days that belong to neither session (system was off) between two sessions. */
export function daysOffBetween(previous: Fitting, next: Fitting): number {
  if (!previous.removedOn) return 0
  const gap = daysBetween(previous.removedOn, next.fittedOn) - 1
  return gap > 0 ? gap : 0
}

export function totalDaysWorn(fittings: Fitting[], todayIso: string): number {
  return fittings.reduce((total, fitting) => total + daysWorn(fitting, todayIso), 0)
}

export function averageWearDays(
  fittings: Fitting[],
  todayIso: string,
  kind?: FittingKind,
): number | null {
  const relevant = kind ? fittings.filter((fitting) => fitting.kind === kind) : fittings
  if (relevant.length === 0) return null
  const total = totalDaysWorn(relevant, todayIso)
  return Math.round((total / relevant.length) * 10) / 10
}

export function latestNewSystem(fittings: Fitting[]): Fitting | null {
  const systems = fittings.filter((fitting) => fitting.kind === 'new-system')
  if (systems.length === 0) return null
  return sortFittings(systems).at(-1) ?? null
}

/**
 * Works out what is due and when the next actions must happen.
 *
 * Replacement dates count from the day the current *new* system was fitted, so
 * days the system spent off don't push the replacement back.
 */
export function computeSchedule(
  fittings: Fitting[],
  settings: Settings,
  todayIso: string,
): Schedule {
  const current = currentFitting(fittings)
  const currentDaysWorn = current ? daysWorn(current, todayIso) : 0
  const refitDueOn = current ? addDaysISO(current.fittedOn, settings.refitIntervalDays) : null
  const refitOverdue = refitDueOn ? todayIso > refitDueOn : false
  const systemFitting = latestNewSystem(fittings)

  if (!systemFitting) {
    return {
      current,
      currentDaysWorn,
      refitDueOn,
      refitOverdue,
      systemFitting: null,
      systemDueOn: null,
      stylistByOn: null,
      orderByOn: null,
      phase: 'no-system',
    }
  }

  const systemDueOn = addDaysISO(systemFitting.fittedOn, settings.newSystemIntervalDays)
  const stylistByOn = addDaysISO(systemDueOn, -settings.stylistLeadDays)
  const orderByOn = addDaysISO(stylistByOn, -settings.orderLeadDays)

  const phase: SchedulePhase =
    todayIso >= systemDueOn
      ? 'due'
      : todayIso >= stylistByOn
        ? 'stylist'
        : todayIso >= orderByOn
          ? 'order'
          : 'ok'

  return {
    current,
    currentDaysWorn,
    refitDueOn,
    refitOverdue,
    systemFitting,
    systemDueOn,
    stylistByOn,
    orderByOn,
    phase,
  }
}

export function sumCosts(costs: CostEntry[], category?: CostCategory): number {
  return costs.reduce(
    (total, cost) => (category && cost.category !== category ? total : total + cost.amountMinor),
    0,
  )
}

export function costsByCategory(costs: CostEntry[]): Record<CostCategory, number> {
  const totals: Record<CostCategory, number> = { system: 0, styling: 0, fitting: 0 }
  for (const cost of costs) totals[cost.category] += cost.amountMinor
  return totals
}

export interface MonthlyTotal {
  month: number
  label: string
  totalMinor: number
  byCategory: Record<CostCategory, number>
}

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

export function monthlyTotals(costs: CostEntry[], year: number): MonthlyTotal[] {
  const months: MonthlyTotal[] = MONTH_LABELS.map((label, index) => ({
    month: index + 1,
    label,
    totalMinor: 0,
    byCategory: { system: 0, styling: 0, fitting: 0 },
  }))

  for (const cost of costs) {
    const costYear = Number(cost.spentOn.slice(0, 4))
    if (costYear !== year) continue
    const bucket = months[Number(cost.spentOn.slice(5, 7)) - 1]
    if (!bucket) continue
    bucket.totalMinor += cost.amountMinor
    bucket.byCategory[cost.category] += cost.amountMinor
  }

  return months
}

export function availableYears(costs: CostEntry[]): number[] {
  return [...new Set(costs.map((cost) => Number(cost.spentOn.slice(0, 4))))].sort((a, b) => b - a)
}

/** Cost per day worn, in minor units (rounded), or null when nothing has been worn yet. */
export function costPerWornDay(totalCostMinor: number, wornDays: number): number | null {
  if (wornDays <= 0) return null
  return Math.round(totalCostMinor / wornDays)
}

export interface MonthlyAverage {
  /** Average spend per calendar month, in minor units (rounded). */
  perMonthMinor: number
  /** Calendar months covered, including months with no spend at all. */
  months: number
  /** First day of the earliest month that has a cost, for the "since ..." hint. */
  from: string
}

/**
 * Average spend per calendar month since the first recorded cost.
 *
 * Every month counts, so the quiet months where nothing was bought pull the
 * average down — that keeps the figure honest instead of only averaging the
 * months that happened to have a receipt.
 */
export function averageMonthlyCost(costs: CostEntry[], todayIso: string): MonthlyAverage | null {
  if (costs.length === 0) return null

  let earliest = costs[0].spentOn
  for (const cost of costs) {
    if (cost.spentOn < earliest) earliest = cost.spentOn
  }

  const months = monthsInclusive(earliest, todayIso)
  return {
    perMonthMinor: Math.round(sumCosts(costs) / months),
    months,
    from: `${earliest.slice(0, 7)}-01`,
  }
}
