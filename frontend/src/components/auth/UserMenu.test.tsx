import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { UserMenu } from './UserMenu'

// Mock the billing API
vi.mock('@/api/billing', () => ({
  createCheckoutSession: vi.fn(),
  createPortalSession: vi.fn(),
}))

import { createCheckoutSession, createPortalSession } from '@/api/billing'

const mockUser = {
  uid: 'test-uid-123',
  email: 'test@example.com',
  displayName: 'Test User',
  photoURL: 'https://example.com/photo.jpg',
}

const mockProUser = {
  ...mockUser,
  tier: 'pro' as const,
}

const mockFreeUser = {
  ...mockUser,
  tier: 'free' as const,
}

describe('UserMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows user avatar', () => {
    render(
      <UserMenu
        user={mockUser}
        onLogout={vi.fn()}
      />
    )

    const avatar = screen.getByRole('img', { name: /avatar/i })
    expect(avatar).toBeInTheDocument()
    expect(avatar).toHaveAttribute('src', mockUser.photoURL)
  })

  it('shows user display name', () => {
    render(
      <UserMenu
        user={mockUser}
        onLogout={vi.fn()}
      />
    )

    // Click to open dropdown
    fireEvent.click(screen.getByRole('button'))

    expect(screen.getByText(mockUser.displayName!)).toBeInTheDocument()
  })

  it('shows user email when no display name', () => {
    const userWithoutName = { ...mockUser, displayName: null }

    render(
      <UserMenu
        user={userWithoutName}
        onLogout={vi.fn()}
      />
    )

    // Click to open dropdown
    fireEvent.click(screen.getByRole('button'))

    expect(screen.getByText(mockUser.email!)).toBeInTheDocument()
  })

  it('shows fallback avatar when no photoURL', () => {
    const userWithoutPhoto = { ...mockUser, photoURL: null }

    render(
      <UserMenu
        user={userWithoutPhoto}
        onLogout={vi.fn()}
      />
    )

    // Should show initials or default avatar
    const avatarButton = screen.getByRole('button')
    expect(avatarButton).toBeInTheDocument()
  })

  it('toggles dropdown menu on click', () => {
    render(
      <UserMenu
        user={mockUser}
        onLogout={vi.fn()}
      />
    )

    // Dropdown should be closed initially
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    // Click to open
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    // Click again to close
    fireEvent.click(screen.getByRole('button'))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('calls onLogout when logout button is clicked', () => {
    const mockLogout = vi.fn()

    render(
      <UserMenu
        user={mockUser}
        onLogout={mockLogout}
      />
    )

    // Open dropdown
    fireEvent.click(screen.getByRole('button'))

    // Click logout
    fireEvent.click(screen.getByRole('menuitem', { name: /log out/i }))

    expect(mockLogout).toHaveBeenCalledTimes(1)
  })

  it('closes dropdown when logout is clicked', () => {
    const mockLogout = vi.fn()

    render(
      <UserMenu
        user={mockUser}
        onLogout={mockLogout}
      />
    )

    // Open dropdown
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    // Click logout
    fireEvent.click(screen.getByRole('menuitem', { name: /log out/i }))

    // Dropdown should be closed
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  describe('billing integration', () => {
    it('shows Upgrade to Pro button for free users when getIdToken is provided', () => {
      const mockGetIdToken = vi.fn()

      render(
        <UserMenu
          user={mockFreeUser}
          onLogout={vi.fn()}
          getIdToken={mockGetIdToken}
        />
      )

      // Open dropdown
      fireEvent.click(screen.getByRole('button'))

      expect(screen.getByRole('menuitem', { name: /upgrade to pro/i })).toBeInTheDocument()
    })

    it('shows Manage Subscription button for pro users when getIdToken is provided', () => {
      const mockGetIdToken = vi.fn()

      render(
        <UserMenu
          user={mockProUser}
          onLogout={vi.fn()}
          getIdToken={mockGetIdToken}
        />
      )

      // Open dropdown
      fireEvent.click(screen.getByRole('button'))

      expect(screen.getByRole('menuitem', { name: /manage subscription/i })).toBeInTheDocument()
    })

    it('shows Pro badge for pro users', () => {
      render(
        <UserMenu
          user={mockProUser}
          onLogout={vi.fn()}
        />
      )

      // Open dropdown
      fireEvent.click(screen.getByRole('button'))

      expect(screen.getByText('PRO')).toBeInTheDocument()
    })

    it('does not show Pro badge for free users', () => {
      render(
        <UserMenu
          user={mockFreeUser}
          onLogout={vi.fn()}
        />
      )

      // Open dropdown
      fireEvent.click(screen.getByRole('button'))

      expect(screen.queryByText('PRO')).not.toBeInTheDocument()
    })

    it('does not show billing buttons when getIdToken is not provided', () => {
      render(
        <UserMenu
          user={mockFreeUser}
          onLogout={vi.fn()}
        />
      )

      // Open dropdown
      fireEvent.click(screen.getByRole('button'))

      expect(screen.queryByRole('menuitem', { name: /upgrade to pro/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('menuitem', { name: /manage subscription/i })).not.toBeInTheDocument()
    })

    it('calls createCheckoutSession when Upgrade to Pro is clicked', async () => {
      const mockGetIdToken = vi.fn().mockResolvedValue('test-token')
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
        <UserMenu
          user={mockFreeUser}
          onLogout={vi.fn()}
          getIdToken={mockGetIdToken}
        />
      )

      // Open dropdown
      fireEvent.click(screen.getByRole('button'))

      // Click upgrade
      fireEvent.click(screen.getByRole('menuitem', { name: /upgrade to pro/i }))

      await waitFor(() => {
        expect(mockGetIdToken).toHaveBeenCalled()
        expect(mockCheckout).toHaveBeenCalledWith('test-token')
      })

      // Restore window.location
      window.location = originalLocation
    })

    it('calls createPortalSession when Manage Subscription is clicked', async () => {
      const mockGetIdToken = vi.fn().mockResolvedValue('test-token')
      const mockPortal = createPortalSession as ReturnType<typeof vi.fn>
      mockPortal.mockResolvedValueOnce({
        url: 'https://billing.stripe.com/test',
      })

      // Mock window.location.href
      const originalLocation = window.location
      delete (window as any).location
      window.location = { href: '' } as Location

      render(
        <UserMenu
          user={mockProUser}
          onLogout={vi.fn()}
          getIdToken={mockGetIdToken}
        />
      )

      // Open dropdown
      fireEvent.click(screen.getByRole('button'))

      // Click manage subscription
      fireEvent.click(screen.getByRole('menuitem', { name: /manage subscription/i }))

      await waitFor(() => {
        expect(mockGetIdToken).toHaveBeenCalled()
        expect(mockPortal).toHaveBeenCalledWith('test-token')
      })

      // Restore window.location
      window.location = originalLocation
    })
  })
})
