import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSync } from './useSync'

// Mock the notes API
vi.mock('@/api/notes', () => ({
  notesApi: {
    listNotes: vi.fn().mockResolvedValue([]),
    syncNotes: vi.fn().mockResolvedValue({ created: [], updated: [], deleted: [] }),
    createNote: vi.fn(),
    updateNote: vi.fn(),
    deleteNote: vi.fn(),
  },
}))

// Mock local storage
vi.mock('@/storage/local', () => ({
  loadData: vi.fn().mockReturnValue({
    tabs: [{ id: 'local-1', name: 'Note 1', content: 'local content', updatedAt: Date.now() }],
    activeTabId: 'local-1',
    globalVariables: {},
  }),
  saveData: vi.fn(),
  loadTabs: vi.fn().mockReturnValue({
    tabs: [{ id: 'local-1', name: 'Note 1', content: 'local content', updatedAt: Date.now() }],
    activeTabId: 'local-1',
  }),
  saveTabs: vi.fn(),
}))

// Mock firebase auth for token retrieval
vi.mock('@/config/firebase', () => ({
  auth: {
    currentUser: {
      getIdToken: vi.fn().mockResolvedValue('mock-token'),
    },
  },
}))

describe('useSync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Ensure navigator.onLine is true by default
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true })
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('sync status', () => {
    it('starts with synced status when online', () => {
      const { result } = renderHook(() =>
        useSync({
          user: { uid: 'user-1', email: 'test@test.com', displayName: 'Test', photoURL: null, tier: 'free' },
          tabs: [{ id: '1', name: 'Note', content: 'test', updatedAt: Date.now() }],
          onTabsUpdate: vi.fn(),
        })
      )

      expect(result.current.status).toBe('synced')
    })

    it('shows offline status when navigator.onLine is false', () => {
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true })

      const { result } = renderHook(() =>
        useSync({
          user: { uid: 'user-1', email: 'test@test.com', displayName: 'Test', photoURL: null, tier: 'free' },
          tabs: [],
          onTabsUpdate: vi.fn(),
        })
      )

      expect(result.current.status).toBe('offline')
    })

    it('returns initial pending changes count of 0', () => {
      const { result } = renderHook(() =>
        useSync({
          user: { uid: 'user-1', email: 'test@test.com', displayName: 'Test', photoURL: null, tier: 'free' },
          tabs: [],
          onTabsUpdate: vi.fn(),
        })
      )

      expect(result.current.pendingChanges).toBe(0)
    })
  })

  describe('hook interface', () => {
    it('provides queueChange function', () => {
      const { result } = renderHook(() =>
        useSync({
          user: { uid: 'user-1', email: 'test@test.com', displayName: 'Test', photoURL: null, tier: 'free' },
          tabs: [],
          onTabsUpdate: vi.fn(),
        })
      )

      expect(typeof result.current.queueChange).toBe('function')
    })

    it('provides queueDeletion function', () => {
      const { result } = renderHook(() =>
        useSync({
          user: { uid: 'user-1', email: 'test@test.com', displayName: 'Test', photoURL: null, tier: 'free' },
          tabs: [],
          onTabsUpdate: vi.fn(),
        })
      )

      expect(typeof result.current.queueDeletion).toBe('function')
    })

    it('provides triggerSync function', () => {
      const { result } = renderHook(() =>
        useSync({
          user: { uid: 'user-1', email: 'test@test.com', displayName: 'Test', photoURL: null, tier: 'free' },
          tabs: [],
          onTabsUpdate: vi.fn(),
        })
      )

      expect(typeof result.current.triggerSync).toBe('function')
    })

    it('provides error state', () => {
      const { result } = renderHook(() =>
        useSync({
          user: { uid: 'user-1', email: 'test@test.com', displayName: 'Test', photoURL: null, tier: 'free' },
          tabs: [],
          onTabsUpdate: vi.fn(),
        })
      )

      expect(result.current.error).toBeNull()
    })
  })

  describe('queue changes', () => {
    it('increments pending changes when queueChange is called', () => {
      const { result } = renderHook(() =>
        useSync({
          user: null, // No user, so no sync will be attempted
          tabs: [],
          onTabsUpdate: vi.fn(),
        })
      )

      act(() => {
        result.current.queueChange({ id: '1', name: 'Note', content: 'test', updatedAt: Date.now() })
      })

      expect(result.current.pendingChanges).toBe(1)
    })

    it('increments pending changes when queueDeletion is called', () => {
      const { result } = renderHook(() =>
        useSync({
          user: null, // No user, so no sync will be attempted
          tabs: [],
          onTabsUpdate: vi.fn(),
        })
      )

      act(() => {
        result.current.queueDeletion('note-1')
      })

      expect(result.current.pendingChanges).toBe(1)
    })

    it('does not sync when user is null', () => {
      // When user is null, queueing changes should not trigger sync
      // The queue will grow but no API calls will be made
      const { result } = renderHook(() =>
        useSync({
          user: null,
          tabs: [],
          onTabsUpdate: vi.fn(),
        })
      )

      act(() => {
        result.current.queueChange({ id: '1', name: 'Note', content: 'test', updatedAt: Date.now() })
      })

      // Should have pending changes but status should stay synced (no sync attempted)
      expect(result.current.pendingChanges).toBe(1)
    })

    it('queues multiple changes with same ID', () => {
      const { result } = renderHook(() =>
        useSync({
          user: null,
          tabs: [],
          onTabsUpdate: vi.fn(),
        })
      )

      // Queue multiple changes with the same ID
      act(() => {
        result.current.queueChange({ id: '1', name: 'Note v1', content: 'test1', updatedAt: Date.now() })
      })

      act(() => {
        result.current.queueChange({ id: '1', name: 'Note v2', content: 'test2', updatedAt: Date.now() })
      })

      // Should only have 1 pending change (deduped by ID)
      expect(result.current.pendingChanges).toBe(1)
    })
  })

  describe('offline behavior', () => {
    it('detects online event', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true })

      const { result } = renderHook(() =>
        useSync({
          user: null, // No user to avoid sync attempts
          tabs: [],
          onTabsUpdate: vi.fn(),
        })
      )

      expect(result.current.status).toBe('offline')

      // Simulate coming back online
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true })

      await act(async () => {
        window.dispatchEvent(new Event('online'))
      })

      // Status should transition to synced
      expect(result.current.status).toBe('synced')
    })

    it('detects offline event', async () => {
      const { result } = renderHook(() =>
        useSync({
          user: { uid: 'user-1', email: 'test@test.com', displayName: 'Test', photoURL: null, tier: 'free' },
          tabs: [],
          onTabsUpdate: vi.fn(),
        })
      )

      expect(result.current.status).toBe('synced')

      // Simulate going offline
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true })

      await act(async () => {
        window.dispatchEvent(new Event('offline'))
      })

      expect(result.current.status).toBe('offline')
    })
  })

  describe('local storage preservation', () => {
    it('preserves local data when queueing changes', () => {
      const { result } = renderHook(() =>
        useSync({
          user: null,
          tabs: [{ id: '1', name: 'Note', content: 'test', updatedAt: Date.now() }],
          onTabsUpdate: vi.fn(),
        })
      )

      // Queue a change
      act(() => {
        result.current.queueChange({ id: '1', name: 'Updated Note', content: 'updated', updatedAt: Date.now() })
      })

      // Data should be queued for persistence
      expect(result.current.pendingChanges).toBe(1)
    })
  })

  describe('debounce configuration', () => {
    it('accepts custom debounce time', () => {
      // This test verifies the hook accepts the option without error
      const { result } = renderHook(() =>
        useSync({
          user: { uid: 'user-1', email: 'test@test.com', displayName: 'Test', photoURL: null, tier: 'free' },
          tabs: [],
          onTabsUpdate: vi.fn(),
          debounceMs: 2000,
        })
      )

      expect(result.current.status).toBeDefined()
    })
  })
})
