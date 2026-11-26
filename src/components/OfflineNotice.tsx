import { useAppData } from '../state/AppDataContext'
import { Alert } from './ui'

/** Explains that the screen is showing the last downloaded copy. */
export function OfflineNotice() {
  const { offlineSnapshot, snapshotSavedAt } = useAppData()
  if (!offlineSnapshot) return null

  const when = snapshotSavedAt
    ? new Date(snapshotSavedAt).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  return (
    <Alert tone="warn">
      <strong>Offline copy.</strong> Showing the last sync{when ? ` from ${when}` : ''}. Changes are
      paused until the connection is back.
    </Alert>
  )
}
