import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useSubscription, FREE_NOTE_LIMIT } from './useSubscription'
import type { AuthUser, UserTier } from './useAuth'

// Test helper to create mock user
function createMockUser(tier: UserTier, uid = 'test-uid'): AuthUser {
  return {
    uid,
    email: 'test@example.com',
    displayName: 'Test User',
    photoURL: null,
    tier,
  }
}

describe('useSubscription', () => {
  describe('tier status', () => {
    it('returns free tier when user is free', () => {
      const user = createMockUser('free')
      const { result } = renderHook(() => useSubscription(user, 3))

      expect(result.current.tier).toBe('free')
    })

    it('returns pro tier when user is pro', () => {
      const user = createMockUser('pro')
      const { result } = renderHook(() => useSubscription(user, 3))

      expect(result.current.tier).toBe('pro')
    })

    it('returns free tier when user is null', () => {
      const { result } = renderHook(() => useSubscription(null, 0))

      expect(result.current.tier).toBe('free')
    })
  })

  describe('isPro', () => {
    it('returns true for pro users', () => {
      const user = createMockUser('pro')
      const { result } = renderHook(() => useSubscription(user, 3))

      expect(result.current.isPro).toBe(true)
    })

    it('returns false for free users', () => {
      const user = createMockUser('free')
      const { result } = renderHook(() => useSubscription(user, 3))

      expect(result.current.isPro).toBe(false)
    })

    it('returns false when user is null', () => {
      const { result } = renderHook(() => useSubscription(null, 0))

      expect(result.current.isPro).toBe(false)
    })
  })

  describe('isAtLimit', () => {
    it('returns false when free user is under limit', () => {
      const user = createMockUser('free')
      const { result } = renderHook(() => useSubscription(user, 3))

      expect(result.current.isAtLimit).toBe(false)
    })

    it('returns true when free user reaches limit', () => {
      const user = createMockUser('free')
      const { result } = renderHook(() => useSubscription(user, FREE_NOTE_LIMIT))

      expect(result.current.isAtLimit).toBe(true)
    })

    it('returns true when free user exceeds limit', () => {
      const user = createMockUser('free')
      const { result } = renderHook(() => useSubscription(user, FREE_NOTE_LIMIT + 1))

      expect(result.current.isAtLimit).toBe(true)
    })

    it('returns false for pro users even with many notes', () => {
      const user = createMockUser('pro')
      const { result } = renderHook(() => useSubscription(user, 100))

      expect(result.current.isAtLimit).toBe(false)
    })

    it('returns false for anonymous users (no limit enforcement)', () => {
      const { result } = renderHook(() => useSubscription(null, FREE_NOTE_LIMIT))

      expect(result.current.isAtLimit).toBe(false)
    })
  })

  describe('canCreateNote', () => {
    it('returns true when free user is under limit', () => {
      const user = createMockUser('free')
      const { result } = renderHook(() => useSubscription(user, 4))

      expect(result.current.canCreateNote).toBe(true)
    })

    it('returns false when free user is at limit', () => {
      const user = createMockUser('free')
      const { result } = renderHook(() => useSubscription(user, FREE_NOTE_LIMIT))

      expect(result.current.canCreateNote).toBe(false)
    })

    it('returns true for pro users with any number of notes', () => {
      const user = createMockUser('pro')
      const { result } = renderHook(() => useSubscription(user, 100))

      expect(result.current.canCreateNote).toBe(true)
    })

    it('returns true for anonymous users (local storage mode)', () => {
      const { result } = renderHook(() => useSubscription(null, 10))

      expect(result.current.canCreateNote).toBe(true)
    })
  })

  describe('noteCount and noteLimit', () => {
    it('returns the correct note count', () => {
      const user = createMockUser('free')
      const { result } = renderHook(() => useSubscription(user, 3))

      expect(result.current.noteCount).toBe(3)
    })

    it('returns FREE_NOTE_LIMIT for free users', () => {
      const user = createMockUser('free')
      const { result } = renderHook(() => useSubscription(user, 3))

      expect(result.current.noteLimit).toBe(FREE_NOTE_LIMIT)
    })

    it('returns Infinity for pro users (unlimited notes)', () => {
      const user = createMockUser('pro')
      const { result } = renderHook(() => useSubscription(user, 3))

      expect(result.current.noteLimit).toBe(Infinity)
    })

    it('returns Infinity for anonymous users', () => {
      const { result } = renderHook(() => useSubscription(null, 3))

      expect(result.current.noteLimit).toBe(Infinity)
    })
  })

  describe('shouldShowUpgradePrompt', () => {
    it('returns true when free user is at limit', () => {
      const user = createMockUser('free')
      const { result } = renderHook(() => useSubscription(user, FREE_NOTE_LIMIT))

      expect(result.current.shouldShowUpgradePrompt).toBe(true)
    })

    it('returns false when free user is under limit', () => {
      const user = createMockUser('free')
      const { result } = renderHook(() => useSubscription(user, 3))

      expect(result.current.shouldShowUpgradePrompt).toBe(false)
    })

    it('returns false for pro users', () => {
      const user = createMockUser('pro')
      const { result } = renderHook(() => useSubscription(user, FREE_NOTE_LIMIT))

      expect(result.current.shouldShowUpgradePrompt).toBe(false)
    })

    it('returns false for anonymous users', () => {
      const { result } = renderHook(() => useSubscription(null, FREE_NOTE_LIMIT))

      expect(result.current.shouldShowUpgradePrompt).toBe(false)
    })
  })

  describe('FREE_NOTE_LIMIT constant', () => {
    it('should be 5', () => {
      expect(FREE_NOTE_LIMIT).toBe(5)
    })
  })
})
