import type { ReactNode } from 'react'
import { useAppData } from '../state/AppDataContext'
import { Alert, Spinner } from './ui'

/** Blocks the page until the first load finishes, or offers a retry. */
export function DataGate({ children }: { children: ReactNode }) {
  const { status, error, refresh } = useAppData()

  if (status === 'loading') {
    return (
      <div className="page centre-block">
        <Spinner label="Loading your data" />
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="page">
        <Alert>
          <strong>Couldn't load your data.</strong>
          <p className="small">{error}</p>
          <button type="button" className="link" onClick={() => void refresh()}>
            Try again
          </button>
        </Alert>
      </div>
    )
  }

  return <>{children}</>
}
