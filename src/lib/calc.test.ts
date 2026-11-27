import { describe, expect, it } from 'vitest'
import type { CostEntry, Fitting, Settings } from '../types'
import {
  availableYears,
  averageMonthlyCost,
  computeSchedule,
  costPerWornDay,
  costsByCategory,
  currentFitting,
  daysOffBetween,
  daysWorn,
  latestNewSystem,
  monthlyTotals,
  sortFittings,
  sumCosts,
  totalDaysWorn,
} from './calc'

const settings: Settings = {
  refitIntervalDays: 28,
  newSystemIntervalDays: 120,
  stylistLeadDays: 14,
  orderLeadDays: 21,
  currency: 'GBP',
}

let sequence = 0

function fitting(
  fields: Pick<Fitting, 'fittedOn' | 'removedOn'> &
    Partial<Omit<Fitting, 'fittedOn' | 'removedOn'>>,
): Fitting {
  const id = fields.id ?? `f${++sequence}`
  return {
    kind: 'refit',
    comments: '',
    createdAt: `${fields.fittedOn}T09:00:00.000Z`,
    ...fields,
    id,
  }
}

function cost(spentOn: string, category: CostEntry['category'], amountMinor: number): CostEntry {
  return {
    id: `c${++sequence}`,
    spentOn,
    category,
    amountMinor,
    note: '',
    createdAt: `${spentOn}T09:00:00.000Z`,
  }
}

/**
 * A: new system 1 Jan -> 29 Jan (29 days)
 * B: re-fit on 29 Jan -> 26 Feb (29 days)   same day changeover, 0 days off
 * C: re-fit on 28 Feb, still on (open)      26 Feb -> 28 Feb = 1 day off
 */
const A = fitting({ kind: 'new-system', fittedOn: '2026-01-01', removedOn: '2026-01-29' })
const B = fitting({ fittedOn: '2026-01-29', removedOn: '2026-02-26' })
const C = fitting({ fittedOn: '2026-02-28', removedOn: null })
const history = [C, A, B]
const TODAY = '2026-03-28'

describe('wear sessions', () => {
  it('counts days worn inclusively for closed and ongoing sessions', () => {
    expect(daysWorn(A, TODAY)).toBe(29)
    expect(daysWorn(B, TODAY)).toBe(29)
    expect(daysWorn(C, TODAY)).toBe(29)
  })

  it('keeps the day of removal in the old session and stops there', () => {
    expect(B.removedOn).toBe('2026-02-26')
    expect(daysWorn(B, TODAY)).toBe(29)
  })

  it('reports the days the system was off as belonging to neither session', () => {
    expect(daysOffBetween(A, B)).toBe(0)
    expect(daysOffBetween(B, C)).toBe(1)
  })

  it('never counts a gap day inside a session total', () => {
    // 29 + 29 + 29 - the single off day (27 Feb) is not included.
    expect(totalDaysWorn(history, TODAY)).toBe(87)
  })

  it('knows which session is currently being worn', () => {
    expect(currentFitting(history)?.id).toBe(C.id)
    expect(currentFitting([A, B])).toBeNull()
  })

  it('sorts sessions oldest first', () => {
    expect(sortFittings(history).map((item) => item.id)).toEqual([A.id, B.id, C.id])
  })

  it('uses the most recent new system for system age', () => {
    expect(latestNewSystem(history)?.id).toBe(A.id)
    const D = fitting({ kind: 'new-system', fittedOn: '2026-03-01', removedOn: null })
    expect(latestNewSystem([...history, D])?.id).toBe(D.id)
  })
})

describe('schedule', () => {
  it('cascades due date, stylist date and order date from the new system', () => {
    const schedule = computeSchedule(history, settings, TODAY)
    expect(schedule.systemDueOn).toBe('2026-05-01')
    expect(schedule.stylistByOn).toBe('2026-04-17')
    expect(schedule.orderByOn).toBe('2026-03-27')
    expect(schedule.refitDueOn).toBe('2026-03-28')
    expect(schedule.currentDaysWorn).toBe(29)
  })

  it('moves through ok -> order -> stylist -> due', () => {
    expect(computeSchedule(history, settings, '2026-03-26').phase).toBe('ok')
    expect(computeSchedule(history, settings, '2026-03-27').phase).toBe('order')
    expect(computeSchedule(history, settings, '2026-04-16').phase).toBe('order')
    expect(computeSchedule(history, settings, '2026-04-17').phase).toBe('stylist')
    expect(computeSchedule(history, settings, '2026-04-30').phase).toBe('stylist')
    expect(computeSchedule(history, settings, '2026-05-01').phase).toBe('due')
    expect(computeSchedule(history, settings, '2026-06-01').phase).toBe('due')
  })

  it('flags an overdue re-fit without affecting the replacement date', () => {
    expect(computeSchedule(history, settings, '2026-03-28').refitOverdue).toBe(false)
    expect(computeSchedule(history, settings, '2026-03-29').refitOverdue).toBe(true)
    expect(computeSchedule(history, settings, '2026-03-29').systemDueOn).toBe('2026-05-01')
  })

  it('restarts the re-fit window on the day the system goes back on', () => {
    const off = { ...C, removedOn: '2026-03-27' }
    const backOn = fitting({ fittedOn: '2026-03-28', removedOn: null })
    const schedule = computeSchedule([A, B, off, backOn], settings, '2026-03-28')
    expect(schedule.refitDueOn).toBe('2026-04-25')
    expect(schedule.currentDaysWorn).toBe(1)
  })

  it('reports when no new system has ever been logged', () => {
    const schedule = computeSchedule([B], settings, TODAY)
    expect(schedule.phase).toBe('no-system')
    expect(schedule.systemDueOn).toBeNull()
    expect(computeSchedule([], settings, TODAY).current).toBeNull()
  })
})

describe('costs', () => {
  const costs = [
    cost('2026-01-15', 'system', 25000),
    cost('2026-02-10', 'styling', 4500),
    cost('2026-02-10', 'fitting', 3000),
    cost('2026-05-20', 'system', 26000),
    cost('2025-12-01', 'styling', 5000),
  ]

  it('totals by category and overall', () => {
    expect(costsByCategory(costs)).toEqual({ system: 51000, styling: 9500, fitting: 3000 })
    expect(sumCosts(costs)).toBe(63500)
    expect(sumCosts(costs, 'styling')).toBe(9500)
  })

  it('splits spend into months for a year', () => {
    const year = monthlyTotals(costs, 2026)
    expect(year).toHaveLength(12)
    expect(year[0].totalMinor).toBe(25000)
    expect(year[1].totalMinor).toBe(7500)
    expect(year[4].totalMinor).toBe(26000)
    expect(year[11].totalMinor).toBe(0)
    expect(year.reduce((total, month) => total + month.totalMinor, 0)).toBe(58500)
  })

  it('lists the years that have spend, newest first', () => {
    expect(availableYears(costs)).toEqual([2026, 2025])
  })

  it('works out cost per day worn', () => {
    expect(costPerWornDay(63500, 87)).toBe(730)
    expect(costPerWornDay(63500, 0)).toBeNull()
  })

  it('averages spend across every month since the first cost', () => {
    // Earliest cost is Dec 2025; today is Mar 2026 -> Dec, Jan, Feb, Mar = 4 months.
    const average = averageMonthlyCost(costs, '2026-03-28')
    expect(average).not.toBeNull()
    expect(average?.months).toBe(4)
    expect(average?.from).toBe('2025-12-01')
    expect(average?.perMonthMinor).toBe(15875) // 63500 / 4
  })

  it('uses the current month only when the first cost is this month', () => {
    expect(averageMonthlyCost([cost('2026-03-05', 'system', 10000)], '2026-03-28')).toEqual({
      perMonthMinor: 10000,
      months: 1,
      from: '2026-03-01',
    })
  })

  it('reports nothing to average when no costs are logged', () => {
    expect(averageMonthlyCost([], '2026-03-28')).toBeNull()
  })
})
