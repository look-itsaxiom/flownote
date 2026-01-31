/**
 * SyncStatus Component
 *
 * Displays the current sync state with visual indicators:
 * - Synced: Green checkmark
 * - Syncing: Blue spinning icon
 * - Offline: Gray cloud-off icon
 * - Error: Red warning icon
 */

import { SyncStatus as SyncStatusType } from '@/hooks/useSync'

interface SyncStatusIndicatorProps {
  status: SyncStatusType
  pendingChanges?: number
}

interface SyncStatusProps extends SyncStatusIndicatorProps {
  isLoggedIn: boolean
}

/**
 * Checkmark icon for synced state
 */
function CheckIcon() {
  return (
    <svg
      data-testid="sync-icon-synced"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

/**
 * Spinning sync icon for syncing state
 */
function SyncingIcon() {
  return (
    <svg
      data-testid="sync-icon-syncing"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="sync-icon-spinning"
    >
      <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
    </svg>
  )
}

/**
 * Cloud-off icon for offline state
 */
function OfflineIcon() {
  return (
    <svg
      data-testid="sync-icon-offline"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9" />
      <path d="M22.61 16.95A5 5 0 0 0 18 10h-1.26A8 8 0 0 0 8.56 4.69" />
    </svg>
  )
}

/**
 * Warning icon for error state
 */
function ErrorIcon() {
  return (
    <svg
      data-testid="sync-icon-error"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

function getStatusIcon(status: SyncStatusType) {
  switch (status) {
    case 'synced':
      return <CheckIcon />
    case 'syncing':
      return <SyncingIcon />
    case 'offline':
      return <OfflineIcon />
    case 'error':
      return <ErrorIcon />
  }
}

function getStatusText(status: SyncStatusType): string {
  switch (status) {
    case 'synced':
      return 'Synced'
    case 'syncing':
      return 'Syncing'
    case 'offline':
      return 'Offline'
    case 'error':
      return 'Sync Error'
  }
}

function getAriaLabel(status: SyncStatusType, pendingChanges?: number): string {
  const baseLabel = `Sync status: ${status}`
  if (pendingChanges && pendingChanges > 0) {
    return `${baseLabel}, ${pendingChanges} changes pending`
  }
  return baseLabel
}

/**
 * Internal indicator component (always renders)
 */
export function SyncStatusIndicator({ status, pendingChanges = 0 }: SyncStatusIndicatorProps) {
  return (
    <div
      data-testid="sync-status-indicator"
      className={`sync-status sync-status--${status}`}
      aria-label={getAriaLabel(status, pendingChanges)}
      role="status"
    >
      <span className="sync-status__icon">{getStatusIcon(status)}</span>
      <span className="sync-status__text">{getStatusText(status)}</span>
      {pendingChanges > 0 && (
        <span className="sync-status__pending">({pendingChanges} pending)</span>
      )}
    </div>
  )
}

/**
 * Main SyncStatus component (only renders when logged in)
 */
export function SyncStatus({ status, pendingChanges, isLoggedIn }: SyncStatusProps) {
  if (!isLoggedIn) {
    return null
  }

  return <SyncStatusIndicator status={status} pendingChanges={pendingChanges} />
}
