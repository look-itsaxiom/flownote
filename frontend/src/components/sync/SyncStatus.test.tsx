import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SyncStatus, SyncStatusIndicator } from './SyncStatus'

describe('SyncStatus Component', () => {
  describe('synced state', () => {
    it('shows synced indicator when status is synced', () => {
      render(<SyncStatusIndicator status="synced" />)

      expect(screen.getByText('Synced')).toBeInTheDocument()
    })

    it('displays checkmark icon for synced status', () => {
      render(<SyncStatusIndicator status="synced" />)

      const icon = screen.getByTestId('sync-icon-synced')
      expect(icon).toBeInTheDocument()
    })

    it('has green color for synced status', () => {
      render(<SyncStatusIndicator status="synced" />)

      const indicator = screen.getByTestId('sync-status-indicator')
      expect(indicator).toHaveClass('sync-status--synced')
    })
  })

  describe('syncing state', () => {
    it('shows syncing indicator when status is syncing', () => {
      render(<SyncStatusIndicator status="syncing" />)

      expect(screen.getByText('Syncing')).toBeInTheDocument()
    })

    it('displays spinning icon for syncing status', () => {
      render(<SyncStatusIndicator status="syncing" />)

      const icon = screen.getByTestId('sync-icon-syncing')
      expect(icon).toBeInTheDocument()
    })

    it('has blue color for syncing status', () => {
      render(<SyncStatusIndicator status="syncing" />)

      const indicator = screen.getByTestId('sync-status-indicator')
      expect(indicator).toHaveClass('sync-status--syncing')
    })
  })

  describe('offline state', () => {
    it('shows offline indicator when status is offline', () => {
      render(<SyncStatusIndicator status="offline" />)

      expect(screen.getByText('Offline')).toBeInTheDocument()
    })

    it('displays cloud-off icon for offline status', () => {
      render(<SyncStatusIndicator status="offline" />)

      const icon = screen.getByTestId('sync-icon-offline')
      expect(icon).toBeInTheDocument()
    })

    it('has gray color for offline status', () => {
      render(<SyncStatusIndicator status="offline" />)

      const indicator = screen.getByTestId('sync-status-indicator')
      expect(indicator).toHaveClass('sync-status--offline')
    })
  })

  describe('error state', () => {
    it('shows error indicator when status is error', () => {
      render(<SyncStatusIndicator status="error" />)

      expect(screen.getByText('Sync Error')).toBeInTheDocument()
    })

    it('displays error icon for error status', () => {
      render(<SyncStatusIndicator status="error" />)

      const icon = screen.getByTestId('sync-icon-error')
      expect(icon).toBeInTheDocument()
    })

    it('has red color for error status', () => {
      render(<SyncStatusIndicator status="error" />)

      const indicator = screen.getByTestId('sync-status-indicator')
      expect(indicator).toHaveClass('sync-status--error')
    })
  })

  describe('pending changes', () => {
    it('shows pending count when there are unsaved changes', () => {
      render(<SyncStatusIndicator status="synced" pendingChanges={3} />)

      expect(screen.getByText(/3 pending/i)).toBeInTheDocument()
    })

    it('does not show pending count when zero', () => {
      render(<SyncStatusIndicator status="synced" pendingChanges={0} />)

      expect(screen.queryByText(/pending/i)).not.toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('has appropriate aria-label for screen readers', () => {
      render(<SyncStatusIndicator status="synced" />)

      const indicator = screen.getByTestId('sync-status-indicator')
      expect(indicator).toHaveAttribute('aria-label')
    })

    it('describes syncing state for screen readers', () => {
      render(<SyncStatusIndicator status="syncing" />)

      const indicator = screen.getByTestId('sync-status-indicator')
      expect(indicator.getAttribute('aria-label')).toContain('syncing')
    })
  })

  describe('SyncStatus wrapper', () => {
    it('does not render when user is not logged in', () => {
      render(<SyncStatus status="synced" isLoggedIn={false} />)

      expect(screen.queryByTestId('sync-status-indicator')).not.toBeInTheDocument()
    })

    it('renders indicator when user is logged in', () => {
      render(<SyncStatus status="synced" isLoggedIn={true} />)

      expect(screen.getByTestId('sync-status-indicator')).toBeInTheDocument()
    })
  })
})
