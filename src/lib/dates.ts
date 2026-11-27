import { addDays, differenceInCalendarDays, format, isValid, parseISO } from 'date-fns'
import { enGB } from 'date-fns/locale'

export const ISO_DATE_FORMAT = 'yyyy-MM-dd'

/** Today's local calendar date as `yyyy-MM-dd`. */
export function todayISO(now: Date = new Date()): string {
  return format(now, ISO_DATE_FORMAT)
}

export function isValidISODate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(parseISO(value))
}

function toDate(iso: string): Date {
  const date = parseISO(iso)
  if (!isValid(date)) throw new Error(`Invalid ISO date: ${iso}`)
  return date
}

export function addDaysISO(iso: string, days: number): string {
  return format(addDays(toDate(iso), days), ISO_DATE_FORMAT)
}

/** Number of days from start to end, inclusive: the same day counts as 1. */
export function daysInclusive(startISO: string, endISO: string): number {
  return differenceInCalendarDays(toDate(endISO), toDate(startISO)) + 1
}

/** Whole calendar days from `fromISO` to `toISO` (negative when in the past). */
export function daysBetween(fromISO: string, toISO: string): number {
  return differenceInCalendarDays(toDate(toISO), toDate(fromISO))
}

/**
 * Whole calendar months from `startISO` to `endISO`, counting both ends:
 * two dates in the same month span one month. Never returns less than 1.
 */
export function monthsInclusive(startISO: string, endISO: string): number {
  const start = toDate(startISO)
  const end = toDate(endISO)
  const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1
  return months > 0 ? months : 1
}

export function formatDate(iso: string, pattern = 'd MMM yyyy'): string {
  return format(toDate(iso), pattern, { locale: enGB })
}

export function formatLongDate(iso: string): string {
  return formatDate(iso, 'EEEE d MMMM yyyy')
}

export function formatMonthShort(iso: string): string {
  return formatDate(iso, 'MMM')
}

export function isoYear(iso: string): number {
  return Number(iso.slice(0, 4))
}

export function countdownLabel(targetISO: string, todayIso: string = todayISO()): string {
  const diff = daysBetween(todayIso, targetISO)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  return diff > 0 ? `In ${diff} days` : `${Math.abs(diff)} days ago`
}

export function formatDays(days: number): string {
  return `${days} ${days === 1 ? 'day' : 'days'}`
}

const moneyFormatters = new Map<string, Intl.NumberFormat>()

export function formatMoney(amountMinor: number, currency: string): string {
  let formatter = moneyFormatters.get(currency)
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    moneyFormatters.set(currency, formatter)
  }
  return formatter.format(amountMinor / 100)
}

/** Parses a typed amount ("12", "12.5", "£12.50") into integer minor units. */
export function parseMoneyToMinor(input: string): number | null {
  const cleaned = input.trim().replace(/[£$€,\s]/g, '')
  if (!/^(\d+(\.\d{0,2})?|\.\d{1,2})$/.test(cleaned)) return null
  return Math.round(Number(cleaned) * 100)
}

export function formatMoneyInput(amountMinor: number): string {
  return (amountMinor / 100).toFixed(2)
}

/** The bare symbol for a currency, e.g. "£" — falls back to the code itself. */
export function currencySymbol(currency: string): string {
  const parts = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
  }).formatToParts(0)
  return parts.find((part) => part.type === 'currency')?.value ?? currency
}
