import { describe, expect, it } from 'vitest'
import {
  addDaysISO,
  countdownLabel,
  daysBetween,
  daysInclusive,
  formatDate,
  formatMoney,
  formatMoneyInput,
  isValidISODate,
  monthsInclusive,
  parseMoneyToMinor,
} from './dates'

describe('daysInclusive', () => {
  it('counts a same-day fit and removal as one day', () => {
    expect(daysInclusive('2026-11-26', '2026-11-26')).toBe(1)
  })

  it('counts both the fitted day and the removal day', () => {
    expect(daysInclusive('2026-11-01', '2026-11-26')).toBe(26)
    expect(daysInclusive('2026-11-01', '2026-11-29')).toBe(29)
  })

  it('handles month and year boundaries', () => {
    expect(daysInclusive('2026-11-30', '2026-12-02')).toBe(3)
    expect(daysInclusive('2026-12-31', '2027-01-01')).toBe(2)
  })

  it('is not thrown by daylight saving changes', () => {
    // UK clocks go forward on 29 Mar 2026 and back on 25 Oct 2026.
    expect(daysInclusive('2026-03-28', '2026-03-30')).toBe(3)
    expect(daysInclusive('2026-10-24', '2026-10-26')).toBe(3)
    expect(daysInclusive('2026-03-01', '2026-04-01')).toBe(32)
  })
})

describe('addDaysISO / daysBetween', () => {
  it('crosses month and year ends', () => {
    expect(addDaysISO('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDaysISO('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDaysISO('2026-02-28', 1)).toBe('2026-03-01')
  })

  it('measures whole calendar days in both directions', () => {
    expect(daysBetween('2026-11-26', '2026-11-29')).toBe(3)
    expect(daysBetween('2026-11-29', '2026-11-26')).toBe(-3)
    expect(daysBetween('2026-11-26', '2026-11-26')).toBe(0)
  })
})

describe('monthsInclusive', () => {
  it('counts a month once both dates fall inside it', () => {
    expect(monthsInclusive('2026-11-01', '2026-11-26')).toBe(1)
    expect(monthsInclusive('2026-11-30', '2026-11-01')).toBe(1)
  })

  it('counts both end months', () => {
    expect(monthsInclusive('2025-12-01', '2026-03-28')).toBe(4)
    expect(monthsInclusive('2026-01-01', '2026-01-31')).toBe(1)
    expect(monthsInclusive('2026-01-15', '2027-01-02')).toBe(13)
  })

  it('never reports less than one month', () => {
    expect(monthsInclusive('2026-05-01', '2026-03-01')).toBe(1)
  })
})

describe('date helpers', () => {
  it('validates real ISO dates only', () => {
    expect(isValidISODate('2026-11-26')).toBe(true)
    expect(isValidISODate('2026-13-01')).toBe(false)
    expect(isValidISODate('26/11/2026')).toBe(false)
  })

  it('formats dates in UK style', () => {
    expect(formatDate('2026-11-26')).toBe('26 Nov 2026')
    expect(formatDate('2026-11-26', 'EEEE d MMMM')).toBe('Thursday 26 November')
  })

  it('describes the countdown in plain English', () => {
    expect(countdownLabel('2026-11-26', '2026-11-26')).toBe('Today')
    expect(countdownLabel('2026-11-27', '2026-11-26')).toBe('Tomorrow')
    expect(countdownLabel('2026-11-25', '2026-11-26')).toBe('Yesterday')
    expect(countdownLabel('2026-12-06', '2026-11-26')).toBe('In 10 days')
    expect(countdownLabel('2026-11-16', '2026-11-26')).toBe('10 days ago')
  })
})

describe('money helpers', () => {
  it('formats minor units as currency', () => {
    expect(formatMoney(123456, 'GBP')).toBe('£1,234.56')
    expect(formatMoney(0, 'GBP')).toBe('£0.00')
  })

  it('parses typed amounts into minor units', () => {
    expect(parseMoneyToMinor('12')).toBe(1200)
    expect(parseMoneyToMinor('12.5')).toBe(1250)
    expect(parseMoneyToMinor('£12.50')).toBe(1250)
    expect(parseMoneyToMinor('£1,234.50')).toBe(123450)
    expect(parseMoneyToMinor('.5')).toBe(50)
    expect(parseMoneyToMinor('0.05')).toBe(5)
  })

  it('rejects junk instead of guessing', () => {
    expect(parseMoneyToMinor('')).toBeNull()
    expect(parseMoneyToMinor('abc')).toBeNull()
    expect(parseMoneyToMinor('12.345')).toBeNull()
    expect(parseMoneyToMinor('-5')).toBeNull()
  })

  it('round-trips a minor amount for form fields', () => {
    expect(formatMoneyInput(1250)).toBe('12.50')
  })
})
