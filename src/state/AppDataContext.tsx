import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { AppData, Fitting, Settings } from '../types'
import { DEFAULT_SETTINGS } from '../types'
import * as api from '../lib/api'
import { loadCache, saveCache } from '../lib/cache'
import { useAuth } from './AuthContext'

type Status = 'loading' | 'ready' | 'error'

interface AppDataContextValue {
  data: AppData
  status: Status
  error: string | null
  /** True when showing the last downloaded copy because the network failed. */
  offlineSnapshot: boolean
  snapshotSavedAt: string | null
  refresh(): Promise<void>
  saveSettings(next: Settings): Promise<void>
  logFitting(input: api.FittingInput): Promise<void>
  markRemoved(fittingId: string, removedOn: string): Promise<void>
  updateFitting(fitting: Fitting): Promise<void>
  deleteFitting(fittingId: string): Promise<void>
  saveCost(input: api.CostInput, costId?: string): Promise<void>
  deleteCost(costId: string): Promise<void>
}

const AppDataContext = createContext<AppDataContextValue | null>(null)

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong. Please try again.'
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const userId = session?.user.id ?? null

  const [data, setData] = useState<AppData>({
    settings: DEFAULT_SETTINGS,
    fittings: [],
    costs: [],
  })
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState<string | null>(null)
  const [offlineSnapshot, setOfflineSnapshot] = useState(false)
  const [snapshotSavedAt, setSnapshotSavedAt] = useState<string | null>(null)

  const refresh = useCallback(
    async (showSpinner = true) => {
      if (!userId) return
      if (showSpinner) setStatus('loading')
      setError(null)
      try {
        const next = await api.fetchAll(userId)
        setData(next)
        saveCache(userId, next)
        setOfflineSnapshot(false)
        setSnapshotSavedAt(null)
        setStatus('ready')
      } catch (err) {
        const cached = loadCache(userId)
        if (cached) {
          setData({ settings: cached.settings, fittings: cached.fittings, costs: cached.costs })
          setOfflineSnapshot(true)
          setSnapshotSavedAt(cached.savedAt)
          setStatus('ready')
        } else {
          setStatus('error')
        }
        setError(errorMessage(err))
      }
    },
    [userId],
  )

  useEffect(() => {
    void refresh()
  }, [refresh])

  const value = useMemo<AppDataContextValue>(() => {
    const guard = () => {
      if (!userId) throw new Error('You are signed out. Sign in again to continue.')
      if (offlineSnapshot) {
        throw new Error('You are viewing a saved offline copy. Reconnect to make changes.')
      }
    }

    const run = async (action: () => Promise<unknown>) => {
      guard()
      try {
        await action()
      } catch (err) {
        throw new Error(errorMessage(err))
      }
      await refresh(false)
    }

    return {
      data,
      status,
      error,
      offlineSnapshot,
      snapshotSavedAt,
      refresh: () => refresh(true),
      saveSettings: (next: Settings) =>
        run(() => api.saveSettings(userId as string, next)),
      logFitting: (input: api.FittingInput) => run(() => api.logFitting(input)),
      markRemoved: (fittingId: string, removedOn: string) =>
        run(() => api.markRemoved(fittingId, removedOn)),
      updateFitting: (fitting: Fitting) =>
        run(() =>
          api.updateFitting(fitting.id, {
            kind: fitting.kind,
            fittedOn: fitting.fittedOn,
            removedOn: fitting.removedOn,
            comments: fitting.comments,
          }),
        ),
      deleteFitting: (fittingId: string) => run(() => api.deleteFitting(fittingId)),
      saveCost: (input: api.CostInput, costId?: string) =>
        run(() =>
          costId ? api.updateCost(costId, input) : api.addCost(userId as string, input),
        ),
      deleteCost: (costId: string) => run(() => api.deleteCost(costId)),
    }
  }, [data, status, error, offlineSnapshot, snapshotSavedAt, refresh, userId])

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export function useAppData(): AppDataContextValue {
  const value = useContext(AppDataContext)
  if (!value) throw new Error('useAppData must be used inside <AppDataProvider>')
  return value
}

