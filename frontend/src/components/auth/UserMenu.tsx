import { useState, useRef, useEffect, useCallback } from 'react'
import { ProBadge } from '@/components/billing'
import { createCheckoutSession, createPortalSession } from '@/api/billing'
import type { UserTier } from '@/hooks/useAuth'

interface User {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
  tier?: UserTier
}

interface UserMenuProps {
  user: User
  onLogout: () => void
  /** Function to get the Firebase ID token for billing operations */
  getIdToken?: () => Promise<string>
}

// Logout icon SVG
function LogoutIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

// Upgrade icon (arrow up in circle)
function UpgradeIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="16 12 12 8 8 12" />
      <line x1="12" y1="16" x2="12" y2="8" />
    </svg>
  )
}

// Settings/manage icon
function ManageIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function getInitials(name: string | null, email: string | null): string {
  if (name) {
    const parts = name.split(' ')
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }
  if (email) {
    return email.substring(0, 2).toUpperCase()
  }
  return '?'
}

export function UserMenu({ user, onLogout, getIdToken }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const displayName = user.displayName || user.email || 'User'
  const initials = getInitials(user.displayName, user.email)
  const isPro = user.tier === 'pro'

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Close on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const handleLogout = () => {
    setIsOpen(false)
    onLogout()
  }

  const toggleMenu = () => {
    setIsOpen((prev) => !prev)
  }

  const handleUpgrade = useCallback(async () => {
    if (!getIdToken || isProcessing) return

    setIsProcessing(true)
    try {
      const idToken = await getIdToken()
      const { url } = await createCheckoutSession(idToken)
      window.location.href = url
    } catch (err) {
      console.error('Failed to start checkout:', err)
      // Could add error toast here
    } finally {
      setIsProcessing(false)
    }
  }, [getIdToken, isProcessing])

  const handleManageSubscription = useCallback(async () => {
    if (!getIdToken || isProcessing) return

    setIsProcessing(true)
    try {
      const idToken = await getIdToken()
      const { url } = await createPortalSession(idToken)
      window.location.href = url
    } catch (err) {
      console.error('Failed to open customer portal:', err)
      // Could add error toast here
    } finally {
      setIsProcessing(false)
    }
  }, [getIdToken, isProcessing])

  return (
    <div className="user-menu" ref={menuRef}>
      <button
        className="user-menu__trigger"
        onClick={toggleMenu}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt="User avatar"
            className="user-menu__avatar"
          />
        ) : (
          <div className="user-menu__avatar user-menu__avatar--initials">
            {initials}
          </div>
        )}
      </button>

      {isOpen && (
        <div className="user-menu__dropdown" role="menu">
          <div className="user-menu__header">
            <div className="user-menu__name-row">
              <span className="user-menu__name">{displayName}</span>
              <ProBadge tier={user.tier} size="small" />
            </div>
            {user.email && user.displayName && (
              <span className="user-menu__email">{user.email}</span>
            )}
          </div>
          <div className="user-menu__divider" />

          {/* Billing options */}
          {getIdToken && (
            <>
              {isPro ? (
                <button
                  className="user-menu__item"
                  onClick={handleManageSubscription}
                  role="menuitem"
                  disabled={isProcessing}
                >
                  <ManageIcon />
                  <span>{isProcessing ? 'Loading...' : 'Manage Subscription'}</span>
                </button>
              ) : (
                <button
                  className="user-menu__item user-menu__item--upgrade"
                  onClick={handleUpgrade}
                  role="menuitem"
                  disabled={isProcessing}
                >
                  <UpgradeIcon />
                  <span>{isProcessing ? 'Loading...' : 'Upgrade to Pro'}</span>
                </button>
              )}
              <div className="user-menu__divider" />
            </>
          )}

          <button
            className="user-menu__item"
            onClick={handleLogout}
            role="menuitem"
          >
            <LogoutIcon />
            <span>Log out</span>
          </button>
        </div>
      )}
    </div>
  )
}
