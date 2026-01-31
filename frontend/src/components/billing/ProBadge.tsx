import type { UserTier } from '@/hooks/useAuth'

interface ProBadgeProps {
  /** User's subscription tier */
  tier: UserTier | undefined
  /** Size variant of the badge */
  size?: 'small' | 'medium'
}

/**
 * Badge component that displays "PRO" for paid users
 * Returns null for free tier or undefined tier
 */
export function ProBadge({ tier, size = 'medium' }: ProBadgeProps) {
  if (tier !== 'pro') {
    return null
  }

  const sizeClass = size === 'small' ? 'pro-badge--small' : ''

  return (
    <span
      className={`pro-badge ${sizeClass}`.trim()}
      aria-label="Pro subscription"
    >
      PRO
    </span>
  )
}
