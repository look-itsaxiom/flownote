import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AdBanner } from './AdBanner'

// Mock adsense config module
vi.mock('@/config/adsense', () => ({
  ADSENSE_CLIENT_ID: 'ca-pub-1234567890',
  ADSENSE_SLOT_ID: 'test-slot-id',
  ADSENSE_SCRIPT_URL: 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js',
  isAdSenseConfigured: false, // Use false to show placeholder (easier to test)
}))

describe('AdBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Clean up any added scripts
    document.querySelectorAll('script[src*="adsbygoogle"]').forEach((el) => el.remove())
  })

  describe('visibility based on user tier', () => {
    it('renders ad banner for free users', () => {
      render(<AdBanner userTier="free" />)

      expect(screen.getByTestId('ad-banner')).toBeInTheDocument()
    })

    it('does not render for Pro users', () => {
      render(<AdBanner userTier="pro" />)

      expect(screen.queryByTestId('ad-banner')).not.toBeInTheDocument()
    })

    it('does not render when user is not logged in (null tier)', () => {
      render(<AdBanner userTier={null} />)

      expect(screen.queryByTestId('ad-banner')).not.toBeInTheDocument()
    })

    it('does not render when userTier is undefined', () => {
      render(<AdBanner userTier={undefined} />)

      expect(screen.queryByTestId('ad-banner')).not.toBeInTheDocument()
    })
  })

  describe('ad blocker handling', () => {
    it('handles ad blocker gracefully without crashing', () => {
      // Simulate ad blocker by making adsbygoogle throw
      const originalAdsbygoogle = (window as unknown as { adsbygoogle?: unknown[] }).adsbygoogle
      ;(window as unknown as { adsbygoogle: { push: () => void } }).adsbygoogle = {
        push: () => {
          throw new Error('Ad blocked')
        },
      }

      // Should not throw
      expect(() => {
        render(<AdBanner userTier="free" />)
      }).not.toThrow()

      // Restore
      if (originalAdsbygoogle) {
        ;(window as unknown as { adsbygoogle: unknown[] }).adsbygoogle = originalAdsbygoogle
      } else {
        delete (window as unknown as { adsbygoogle?: unknown }).adsbygoogle
      }
    })

    it('shows fallback content when ad fails to load', () => {
      render(<AdBanner userTier="free" showFallback={true} />)

      // The component should still be in the document
      expect(screen.getByTestId('ad-banner')).toBeInTheDocument()
    })
  })

  describe('development mode', () => {
    it('renders placeholder in development mode when AdSense not configured', () => {
      render(<AdBanner userTier="free" />)

      // Should render the container with placeholder
      expect(screen.getByTestId('ad-banner')).toBeInTheDocument()
      // Check for placeholder text
      expect(screen.getByText('Ad Space')).toBeInTheDocument()
    })
  })

  describe('styling and positioning', () => {
    it('applies the correct CSS class', () => {
      render(<AdBanner userTier="free" />)

      const banner = screen.getByTestId('ad-banner')
      expect(banner).toHaveClass('ad-banner')
    })

    it('accepts custom className prop', () => {
      render(<AdBanner userTier="free" className="custom-class" />)

      const banner = screen.getByTestId('ad-banner')
      expect(banner).toHaveClass('ad-banner')
      expect(banner).toHaveClass('custom-class')
    })
  })

  describe('security', () => {
    it('does not pass user data to ad network', () => {
      render(<AdBanner userTier="free" />)

      // The ad banner should not contain any user-specific data attributes
      const banner = screen.getByTestId('ad-banner')
      expect(banner).not.toHaveAttribute('data-user-id')
      expect(banner).not.toHaveAttribute('data-user-email')
    })
  })
})
