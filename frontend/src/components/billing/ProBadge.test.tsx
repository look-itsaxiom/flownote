import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProBadge } from './ProBadge'

describe('ProBadge', () => {
  describe('visibility based on tier', () => {
    it('renders badge when tier is pro', () => {
      render(<ProBadge tier="pro" />)

      expect(screen.getByText(/pro/i)).toBeInTheDocument()
    })

    it('does not render badge when tier is free', () => {
      render(<ProBadge tier="free" />)

      expect(screen.queryByText(/pro/i)).not.toBeInTheDocument()
    })

    it('does not render badge when tier is undefined', () => {
      render(<ProBadge tier={undefined} />)

      expect(screen.queryByText(/pro/i)).not.toBeInTheDocument()
    })
  })

  describe('styling', () => {
    it('has appropriate badge styling class', () => {
      render(<ProBadge tier="pro" />)

      const badge = screen.getByText(/pro/i)
      expect(badge).toHaveClass('pro-badge')
    })
  })

  describe('size variants', () => {
    it('renders small variant', () => {
      render(<ProBadge tier="pro" size="small" />)

      const badge = screen.getByText(/pro/i)
      expect(badge).toHaveClass('pro-badge--small')
    })

    it('renders default (medium) variant', () => {
      render(<ProBadge tier="pro" />)

      const badge = screen.getByText(/pro/i)
      expect(badge).not.toHaveClass('pro-badge--small')
    })
  })

  describe('accessibility', () => {
    it('has appropriate aria-label', () => {
      render(<ProBadge tier="pro" />)

      const badge = screen.getByText(/pro/i)
      expect(badge).toHaveAttribute('aria-label', 'Pro subscription')
    })
  })
})
