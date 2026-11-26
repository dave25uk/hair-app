export type FittingKind = 'new-system' | 'refit'

export type CostCategory = 'system' | 'styling' | 'fitting'

/** Calendar dates are always stored as plain `yyyy-MM-dd` strings (no time, no timezone). */
export type IsoDate = string

export interface Settings {
  /** Planned number of days between re-fits. */
  refitIntervalDays: number
  /** Planned number of days a new system should last. */
  newSystemIntervalDays: number
  /** How many days before a new system is due it must be with the stylist. */
  stylistLeadDays: number
  /** How many days before the stylist date the system must be ordered. */
  orderLeadDays: number
  /** ISO 4217 currency code, e.g. GBP. */
  currency: string
}

/** One wear session: a system (new or the same one re-fitted) worn between two dates. */
export interface Fitting {
  id: string
  kind: FittingKind
  fittedOn: IsoDate
  /** `null` means the system is currently on. */
  removedOn: IsoDate | null
  comments: string
  createdAt: string
}

export interface CostEntry {
  id: string
  spentOn: IsoDate
  category: CostCategory
  /** Amount in minor units (pence) so totals never drift. */
  amountMinor: number
  note: string
  createdAt: string
}

export interface AppData {
  settings: Settings
  fittings: Fitting[]
  costs: CostEntry[]
}

export const DEFAULT_SETTINGS: Settings = {
  refitIntervalDays: 28,
  newSystemIntervalDays: 120,
  stylistLeadDays: 14,
  orderLeadDays: 21,
  currency: 'GBP',
}
