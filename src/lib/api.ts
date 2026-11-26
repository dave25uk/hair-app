import {
  DEFAULT_SETTINGS,
  type AppData,
  type CostCategory,
  type CostEntry,
  type Fitting,
  type FittingKind,
  type IsoDate,
  type Settings,
} from '../types'
import { requireSupabase } from './supabase'

interface SettingsRow {
  user_id: string
  refit_interval_days: number
  new_system_interval_days: number
  stylist_lead_days: number
  order_lead_days: number
  currency: string
}

interface FittingRow {
  id: string
  kind: FittingKind
  fitted_on: string
  removed_on: string | null
  comments: string
  created_at: string
}

interface CostRow {
  id: string
  spent_on: string
  category: CostCategory
  amount_minor: number | string
  note: string
  created_at: string
}

function mapSettings(row: SettingsRow): Settings {
  return {
    refitIntervalDays: row.refit_interval_days,
    newSystemIntervalDays: row.new_system_interval_days,
    stylistLeadDays: row.stylist_lead_days,
    orderLeadDays: row.order_lead_days,
    currency: row.currency,
  }
}

function settingsToRow(settings: Settings) {
  return {
    refit_interval_days: settings.refitIntervalDays,
    new_system_interval_days: settings.newSystemIntervalDays,
    stylist_lead_days: settings.stylistLeadDays,
    order_lead_days: settings.orderLeadDays,
    currency: settings.currency,
  }
}

function mapFitting(row: FittingRow): Fitting {
  return {
    id: row.id,
    kind: row.kind,
    fittedOn: row.fitted_on,
    removedOn: row.removed_on,
    comments: row.comments ?? '',
    createdAt: row.created_at,
  }
}

function mapCost(row: CostRow): CostEntry {
  return {
    id: row.id,
    spentOn: row.spent_on,
    category: row.category,
    amountMinor: Number(row.amount_minor),
    note: row.note ?? '',
    createdAt: row.created_at,
  }
}

export interface FittingInput {
  kind: FittingKind
  fittedOn: IsoDate
  /** Day the previous system came off; `null` when there is nothing currently on. */
  previousRemovedOn: IsoDate | null
  comments: string
}

export interface CostInput {
  spentOn: IsoDate
  category: CostCategory
  amountMinor: number
  note: string
}

export async function fetchSettings(userId: string): Promise<Settings> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('hair_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (data) return mapSettings(data as SettingsRow)

  const { data: created, error: insertError } = await client
    .from('hair_settings')
    .insert({ user_id: userId, ...settingsToRow(DEFAULT_SETTINGS) })
    .select('*')
    .single()
  if (insertError) throw new Error(insertError.message)
  return mapSettings(created as SettingsRow)
}

export async function saveSettings(userId: string, settings: Settings): Promise<Settings> {
  const { data, error } = await requireSupabase()
    .from('hair_settings')
    .upsert({ user_id: userId, ...settingsToRow(settings) }, { onConflict: 'user_id' })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return mapSettings(data as SettingsRow)
}

export async function fetchFittings(userId: string): Promise<Fitting[]> {
  const { data, error } = await requireSupabase()
    .from('hair_fittings')
    .select('*')
    .eq('user_id', userId)
    .order('fitted_on', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as FittingRow[]).map(mapFitting)
}

export async function fetchCosts(userId: string): Promise<CostEntry[]> {
  const { data, error } = await requireSupabase()
    .from('hair_costs')
    .select('*')
    .eq('user_id', userId)
    .order('spent_on', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as CostRow[]).map(mapCost)
}

export async function fetchAll(userId: string): Promise<AppData> {
  const [settings, fittings, costs] = await Promise.all([
    fetchSettings(userId),
    fetchFittings(userId),
    fetchCosts(userId),
  ])
  return { settings, fittings, costs }
}

/** Closes the previous session and starts the new one in a single transaction. */
export async function logFitting(input: FittingInput): Promise<string> {
  const { data, error } = await requireSupabase().rpc('hair_log_fitting', {
    p_kind: input.kind,
    p_fitted_on: input.fittedOn,
    p_previous_removed_on: input.previousRemovedOn,
    p_comments: input.comments,
  })
  if (error) throw new Error(error.message)
  return data as string
}

export async function markRemoved(fittingId: string, removedOn: IsoDate): Promise<void> {
  const { error } = await requireSupabase().rpc('hair_mark_removed', {
    p_fitting_id: fittingId,
    p_removed_on: removedOn,
  })
  if (error) throw new Error(error.message)
}

export async function updateFitting(
  fittingId: string,
  patch: Omit<FittingInput, 'previousRemovedOn'> & { removedOn: IsoDate | null },
): Promise<Fitting> {
  const { data, error } = await requireSupabase()
    .from('hair_fittings')
    .update({
      kind: patch.kind,
      fitted_on: patch.fittedOn,
      removed_on: patch.removedOn,
      comments: patch.comments,
    })
    .eq('id', fittingId)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return mapFitting(data as FittingRow)
}

export async function deleteFitting(fittingId: string): Promise<void> {
  const { error } = await requireSupabase().from('hair_fittings').delete().eq('id', fittingId)
  if (error) throw new Error(error.message)
}

export async function addCost(userId: string, input: CostInput): Promise<CostEntry> {
  const { data, error } = await requireSupabase()
    .from('hair_costs')
    .insert({
      user_id: userId,
      spent_on: input.spentOn,
      category: input.category,
      amount_minor: input.amountMinor,
      note: input.note,
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return mapCost(data as CostRow)
}

export async function updateCost(costId: string, input: CostInput): Promise<CostEntry> {
  const { data, error } = await requireSupabase()
    .from('hair_costs')
    .update({
      spent_on: input.spentOn,
      category: input.category,
      amount_minor: input.amountMinor,
      note: input.note,
    })
    .eq('id', costId)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return mapCost(data as CostRow)
}

export async function deleteCost(costId: string): Promise<void> {
  const { error } = await requireSupabase().from('hair_costs').delete().eq('id', costId)
  if (error) throw new Error(error.message)
}
