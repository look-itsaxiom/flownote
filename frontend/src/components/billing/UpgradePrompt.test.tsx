import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { UpgradePrompt } from './UpgradePrompt'

// Mock the billing API
vi.mock('@/api/billing', () => ({
  createCheckoutSession: vi.fn(),
}))

import { createCheckoutSession } from '@/api/billing'

describe('UpgradePrompt', () => {
  const mockGetIdToken = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetIdToken.mockResolvedValue('test-token')
  })

  describe('visibility', () => {
    it('renders when isVisible is true', () => {
      render(
        <UpgradePrompt
          isVisible={true}
          noteCount={5}
          noteLimit={5}
          onClose={vi.fn()}
          getIdToken={mockGetIdToken}
        />
      )

      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('does not render when isVisible is false', () => {
      render(
        <UpgradePrompt
          isVisible={false}
          noteCount={5}
          noteLimit={5}
          onClose={vi.fn()}
          getIdToken={mockGetIdToken}
        />
      )

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('shows upgrade prompt when user is at note limit', () => {
      render(
        <UpgradePrompt
          isVisible={true}
          noteCount={5}
          noteLimit={5}
          onClose={vi.fn()}
          getIdToken={mockGetIdToken}
        />
      )

      expect(screen.getByText(/upgrade to pro/i)).toBeInTheDocument()
      expect(screen.getByText(/5 of 5 notes/i)).toBeInTheDocument()
    })
  })

  describe('content', () => {
    it('displays upgrade benefits', () => {
      render(
        <UpgradePrompt
          isVisible={true}
          noteCount={5}
          noteLimit={5}
          onClose={vi.fn()}
          getIdToken={mockGetIdToken}
        />
      )

      expect(screen.getByText(/unlimited notes/i)).toBeInTheDocument()
      expect(screen.getByText(/no ads/i)).toBeInTheDocument()
    })

    it('shows the current note count and limit', () => {
      render(
        <UpgradePrompt
          isVisible={true}
          noteCount={5}
          noteLimit={5}
          onClose={vi.fn()}
          getIdToken={mockGetIdToken}
        />
      )

      expect(screen.getByText(/5 of 5 notes/i)).toBeInTheDocument()
    })
  })

  describe('checkout redirect', () => {
    it('calls createCheckoutSession when upgrade button is clicked', async () => {
      const mockCheckout = createCheckoutSession as ReturnType<typeof vi.fn>
      mockCheckout.mockResolvedValueOnce({
        url: 'https://checkout.stripe.com/test',
        sessionId: 'cs_test_123',
      })

      // Mock window.location.href
      const originalLocation = window.location
      delete (window as any).location
      window.location = { href: '' } as Location

      render(
        <UpgradePrompt
          isVisible={true}
          noteCount={5}
          noteLimit={5}
          onClose={vi.fn()}
          getIdToken={mockGetIdToken}
        />
      )

      const upgradeButton = screen.getByRole('button', { name: /upgrade now/i })
      fireEvent.click(upgradeButton)

      await waitFor(() => {
        expect(mockGetIdToken).toHaveBeenCalled()
        expect(mockCheckout).toHaveBeenCalledWith('test-token')
      })

      // Restore window.location
      window.location = originalLocation
    })

    it('redirects to Stripe checkout URL on success', async () => {
      const mockCheckout = createCheckoutSession as ReturnType<typeof vi.fn>
      mockCheckout.mockResolvedValueOnce({
        url: 'https://checkout.stripe.com/test-session',
        sessionId: 'cs_test_123',
      })

      // Mock window.location.href
      const originalLocation = window.location
      delete (window as any).location
      window.location = { href: '' } as Location

      render(
        <UpgradePrompt
          isVisible={true}
          noteCount={5}
          noteLimit={5}
          onClose={vi.fn()}
          getIdToken={mockGetIdToken}
        />
      )

      const upgradeButton = screen.getByRole('button', { name: /upgrade now/i })
      fireEvent.click(upgradeButton)

      await waitFor(() => {
        expect(window.location.href).toBe('https://checkout.stripe.com/test-session')
      })

      // Restore window.location
      window.location = originalLocation
    })

    it('shows loading state while processing', async () => {
      let resolveCheckout: (value: any) => void
      const mockCheckout = createCheckoutSession as ReturnType<typeof vi.fn>
      mockCheckout.mockImplementation(
        () => new Promise((resolve) => {
          resolveCheckout = resolve
        })
      )

      // Mock window.location.href
      const originalLocation = window.location
      delete (window as any).location
      window.location = { href: '' } as Location

      render(
        <UpgradePrompt
          isVisible={true}
          noteCount={5}
          noteLimit={5}
          onClose={vi.fn()}
          getIdToken={mockGetIdToken}
        />
      )

      const upgradeButton = screen.getByRole('button', { name: /upgrade now/i })
      fireEvent.click(upgradeButton)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /processing/i })).toBeDisabled()
      })

      // Resolve the promise to clean up
      resolveCheckout!({ url: 'https://checkout.stripe.com/test', sessionId: 'cs_test_123' })

      // Restore window.location
      window.location = originalLocation
    })

    it('shows error message when checkout fails', async () => {
      const mockCheckout = createCheckoutSession as ReturnType<typeof vi.fn>
      mockCheckout.mockRejectedValueOnce(new Error('Checkout failed'))

      render(
        <UpgradePrompt
          isVisible={true}
          noteCount={5}
          noteLimit={5}
          onClose={vi.fn()}
          getIdToken={mockGetIdToken}
        />
      )

      const upgradeButton = screen.getByRole('button', { name: /upgrade now/i })
      fireEvent.click(upgradeButton)

      await waitFor(() => {
        expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
      })
    })
  })

  describe('close functionality', () => {
    it('calls onClose when close button is clicked', () => {
      const mockOnClose = vi.fn()

      render(
        <UpgradePrompt
          isVisible={true}
          noteCount={5}
          noteLimit={5}
          onClose={mockOnClose}
          getIdToken={mockGetIdToken}
        />
      )

      // Use the X close button (aria-label="Close")
      const closeButton = screen.getByRole('button', { name: /^close$/i })
      fireEvent.click(closeButton)

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('calls onClose when clicking outside the modal', () => {
      const mockOnClose = vi.fn()

      render(
        <UpgradePrompt
          isVisible={true}
          noteCount={5}
          noteLimit={5}
          onClose={mockOnClose}
          getIdToken={mockGetIdToken}
        />
      )

      // Click on the overlay (background)
      const overlay = screen.getByTestId('upgrade-prompt-overlay')
      fireEvent.click(overlay)

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('calls onClose when Escape key is pressed', () => {
      const mockOnClose = vi.fn()

      render(
        <UpgradePrompt
          isVisible={true}
          noteCount={5}
          noteLimit={5}
          onClose={mockOnClose}
          getIdToken={mockGetIdToken}
        />
      )

      fireEvent.keyDown(document, { key: 'Escape' })

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('accessibility', () => {
    it('has role="dialog"', () => {
      render(
        <UpgradePrompt
          isVisible={true}
          noteCount={5}
          noteLimit={5}
          onClose={vi.fn()}
          getIdToken={mockGetIdToken}
        />
      )

      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('has aria-labelledby for the title', () => {
      render(
        <UpgradePrompt
          isVisible={true}
          noteCount={5}
          noteLimit={5}
          onClose={vi.fn()}
          getIdToken={mockGetIdToken}
        />
      )

      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveAttribute('aria-labelledby')
    })
  })
})
