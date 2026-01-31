import { useState, useEffect, useCallback } from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
  GithubAuthProvider,
  User,
} from 'firebase/auth'
import { auth } from '@/config/firebase'

/** User subscription tier - determines feature access and ad visibility */
export type UserTier = 'free' | 'pro'

export interface AuthUser {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
  /** User's subscription tier. Defaults to 'free' for new users. */
  tier: UserTier
}

export interface UseAuthReturn {
  user: AuthUser | null
  loading: boolean
  error: Error | null
  loginWithGoogle: () => Promise<void>
  loginWithGithub: () => Promise<void>
  logout: () => Promise<void>
  /** Get Firebase ID token for API authentication */
  getIdToken: () => Promise<string>
}

function mapFirebaseUser(user: User | null): AuthUser | null {
  if (!user) return null
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    // Default to 'free' tier. In a real implementation, this would be
    // fetched from the backend or Firebase custom claims.
    // TODO: Fetch tier from backend when user subscription service is implemented
    tier: 'free',
  }
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        setUser(mapFirebaseUser(firebaseUser))
        setLoading(false)
      },
      (err) => {
        setError(err)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [])

  const loginWithGoogle = useCallback(async () => {
    setError(null)
    try {
      const provider = new GoogleAuthProvider()
      await signInWithPopup(auth, provider)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Login failed'))
      throw err
    }
  }, [])

  const loginWithGithub = useCallback(async () => {
    setError(null)
    try {
      const provider = new GithubAuthProvider()
      await signInWithPopup(auth, provider)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Login failed'))
      throw err
    }
  }, [])

  const logout = useCallback(async () => {
    setError(null)
    try {
      await signOut(auth)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Logout failed'))
      throw err
    }
  }, [])

  const getIdToken = useCallback(async () => {
    const currentUser = auth.currentUser
    if (!currentUser) {
      throw new Error('User not authenticated')
    }
    return currentUser.getIdToken()
  }, [])

  return {
    user,
    loading,
    error,
    loginWithGoogle,
    loginWithGithub,
    logout,
    getIdToken,
  }
}
