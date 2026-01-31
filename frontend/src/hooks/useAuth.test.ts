import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { onAuthStateChanged, signInWithPopup, signOut, GoogleAuthProvider, GithubAuthProvider } from 'firebase/auth'
import { useAuth } from './useAuth'

// Mock the firebase config
vi.mock('@/config/firebase', () => ({
  auth: {
    currentUser: null,
  },
}))

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null user when not logged in', async () => {
    // Setup: onAuthStateChanged calls callback with null (no user)
    vi.mocked(onAuthStateChanged).mockImplementation((_auth, callback) => {
      ;(callback as (user: null) => void)(null)
      return vi.fn() // unsubscribe function
    })

    const { result } = renderHook(() => useAuth())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.user).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it('returns user object when logged in', async () => {
    const mockUser = {
      uid: 'test-uid-123',
      email: 'test@example.com',
      displayName: 'Test User',
      photoURL: 'https://example.com/photo.jpg',
    }

    // Setup: onAuthStateChanged calls callback with user
    vi.mocked(onAuthStateChanged).mockImplementation((_auth, callback) => {
      ;(callback as (user: typeof mockUser) => void)(mockUser)
      return vi.fn()
    })

    const { result } = renderHook(() => useAuth())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.user).toEqual(mockUser)
    expect(result.current.loading).toBe(false)
  })

  it('provides login functions for Google and GitHub', async () => {
    vi.mocked(onAuthStateChanged).mockImplementation((_auth, callback) => {
      ;(callback as (user: null) => void)(null)
      return vi.fn()
    })

    const { result } = renderHook(() => useAuth())

    expect(typeof result.current.loginWithGoogle).toBe('function')
    expect(typeof result.current.loginWithGithub).toBe('function')
  })

  it('loginWithGoogle calls signInWithPopup with GoogleAuthProvider', async () => {
    vi.mocked(onAuthStateChanged).mockImplementation((_auth, callback) => {
      ;(callback as (user: null) => void)(null)
      return vi.fn()
    })

    vi.mocked(signInWithPopup).mockResolvedValue({
      user: { uid: 'google-user' },
    } as never)

    const { result } = renderHook(() => useAuth())

    await act(async () => {
      await result.current.loginWithGoogle()
    })

    expect(signInWithPopup).toHaveBeenCalled()
    expect(GoogleAuthProvider).toHaveBeenCalled()
  })

  it('loginWithGithub calls signInWithPopup with GithubAuthProvider', async () => {
    vi.mocked(onAuthStateChanged).mockImplementation((_auth, callback) => {
      ;(callback as (user: null) => void)(null)
      return vi.fn()
    })

    vi.mocked(signInWithPopup).mockResolvedValue({
      user: { uid: 'github-user' },
    } as never)

    const { result } = renderHook(() => useAuth())

    await act(async () => {
      await result.current.loginWithGithub()
    })

    expect(signInWithPopup).toHaveBeenCalled()
    expect(GithubAuthProvider).toHaveBeenCalled()
  })

  it('logout clears auth state', async () => {
    const mockUser = {
      uid: 'test-uid-123',
      email: 'test@example.com',
      displayName: 'Test User',
      photoURL: null,
    }

    let authCallback: ((user: typeof mockUser | null) => void) | null = null

    vi.mocked(onAuthStateChanged).mockImplementation((_auth, callback) => {
      authCallback = callback as (user: typeof mockUser | null) => void
      authCallback(mockUser) // Start with logged in user
      return vi.fn()
    })

    vi.mocked(signOut).mockImplementation(async () => {
      // Simulate Firebase calling the auth state callback with null
      if (authCallback) {
        authCallback(null)
      }
    })

    const { result } = renderHook(() => useAuth())

    // Verify user is logged in initially
    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser)
    })

    // Call logout
    await act(async () => {
      await result.current.logout()
    })

    // Verify signOut was called
    expect(signOut).toHaveBeenCalled()

    // Verify user is now null
    expect(result.current.user).toBeNull()
  })

  it('handles loading state correctly', async () => {
    // Delay the callback to test loading state
    vi.mocked(onAuthStateChanged).mockImplementation((_auth, callback) => {
      setTimeout(() => {
        ;(callback as (user: null) => void)(null)
      }, 100)
      return vi.fn()
    })

    const { result } = renderHook(() => useAuth())

    // Initially loading should be true
    expect(result.current.loading).toBe(true)

    // Wait for loading to finish
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
  })
})
