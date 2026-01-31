import { useState, useEffect, useCallback } from 'react'
import { createCheckoutSession } from '@/api/billing'

interface UpgradePromptProps {
  /** Whether the prompt should be visible */
  isVisible: boolean
  /** Current number of notes the user has */
  noteCount: number
  /** Maximum notes allowed for the user's tier */
  noteLimit: number
  /** Callback when the prompt is closed */
  onClose: () => void
  /** Function to get the Firebase ID token for authentication */
  getIdToken: () => Promise<string>
}

// Star icon for benefits
function StarIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

// Close icon
function CloseIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

export function UpgradePrompt({
  isVisible,
  noteCount,
  noteLimit,
  onClose,
  getIdToken,
}: UpgradePromptProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Handle Escape key to close
  useEffect(() => {
    if (!isVisible) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isVisible, onClose])

  const handleUpgrade = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const idToken = await getIdToken()
      const { url } = await createCheckoutSession(idToken)
      window.location.href = url
    } catch (err) {
      console.error('Failed to create checkout session:', err)
      setError('Something went wrong. Please try again.')
      setIsLoading(false)
    }
  }, [getIdToken])

  const handleOverlayClick = useCallback(
    (event: React.MouseEvent) => {
      if (event.target === event.currentTarget) {
        onClose()
      }
    },
    [onClose]
  )

  if (!isVisible) {
    return null
  }

  return (
    <div
      className="upgrade-prompt-overlay"
      data-testid="upgrade-prompt-overlay"
      onClick={handleOverlayClick}
    >
      <div
        className="upgrade-prompt"
        role="dialog"
        aria-labelledby="upgrade-prompt-title"
        aria-modal="true"
      >
        <button
          className="upgrade-prompt__close"
          onClick={onClose}
          aria-label="Close"
        >
          <CloseIcon />
        </button>

        <div className="upgrade-prompt__header">
          <h2 id="upgrade-prompt-title" className="upgrade-prompt__title">
            Upgrade to Pro
          </h2>
          <p className="upgrade-prompt__limit-text">
            You've used {noteCount} of {noteLimit} notes
          </p>
        </div>

        <div className="upgrade-prompt__benefits">
          <h3 className="upgrade-prompt__benefits-title">
            Unlock premium features:
          </h3>
          <ul className="upgrade-prompt__benefits-list">
            <li className="upgrade-prompt__benefit">
              <StarIcon />
              <span>Unlimited notes</span>
            </li>
            <li className="upgrade-prompt__benefit">
              <StarIcon />
              <span>No ads</span>
            </li>
            <li className="upgrade-prompt__benefit">
              <StarIcon />
              <span>Cloud sync across devices</span>
            </li>
            <li className="upgrade-prompt__benefit">
              <StarIcon />
              <span>Priority support</span>
            </li>
          </ul>
        </div>

        {error && (
          <div className="upgrade-prompt__error" role="alert">
            {error}
          </div>
        )}

        <div className="upgrade-prompt__actions">
          <button
            className="upgrade-prompt__button upgrade-prompt__button--primary"
            onClick={handleUpgrade}
            disabled={isLoading}
            aria-label={isLoading ? 'Processing...' : 'Upgrade Now'}
          >
            {isLoading ? 'Processing...' : 'Upgrade Now'}
          </button>
          <button
            className="upgrade-prompt__button upgrade-prompt__button--secondary"
            onClick={onClose}
            aria-label="Maybe Later"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  )
}
