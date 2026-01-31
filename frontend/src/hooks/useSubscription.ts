import { useMemo } from 'react'
import type { AuthUser, UserTier } from './useAuth'

/** Maximum number of notes allowed for free tier users */
export const FREE_NOTE_LIMIT = 5

export interface UseSubscriptionReturn {
  /** User's current subscription tier */
  tier: UserTier
  /** Whether the user has a Pro subscription */
  isPro: boolean
  /** Whether the user has reached their note limit */
  isAtLimit: boolean
  /** Whether the user can create a new note */
  canCreateNote: boolean
  /** Current number of notes the user has */
  noteCount: number
  /** Maximum number of notes allowed for the user's tier */
  noteLimit: number
  /** Whether to show the upgrade prompt */
  shouldShowUpgradePrompt: boolean
}

/**
 * Hook to manage subscription state and feature gating
 *
 * @param user - The authenticated user (or null if not logged in)
 * @param noteCount - Current number of notes the user has
 * @returns Subscription state and feature gate functions
 */
export function useSubscription(
  user: AuthUser | null,
  noteCount: number
): UseSubscriptionReturn {
  return useMemo(() => {
    const tier: UserTier = user?.tier ?? 'free'
    const isPro = tier === 'pro'

    // Anonymous users (not logged in) have no limits - they use local storage
    // Free logged-in users have the FREE_NOTE_LIMIT
    // Pro users have unlimited notes
    const isAnonymous = user === null
    const noteLimit = isAnonymous || isPro ? Infinity : FREE_NOTE_LIMIT

    const isAtLimit = !isAnonymous && !isPro && noteCount >= FREE_NOTE_LIMIT
    const canCreateNote = isAnonymous || isPro || noteCount < FREE_NOTE_LIMIT

    // Only show upgrade prompt for logged-in free users who are at their limit
    const shouldShowUpgradePrompt = !isAnonymous && !isPro && noteCount >= FREE_NOTE_LIMIT

    return {
      tier,
      isPro,
      isAtLimit,
      canCreateNote,
      noteCount,
      noteLimit,
      shouldShowUpgradePrompt,
    }
  }, [user, noteCount])
}
