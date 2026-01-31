/**
 * useSync Hook - Handles syncing notes with backend
 *
 * Features:
 * - Debounced saves (not every keystroke)
 * - Offline detection and queuing
 * - Automatic sync when back online
 * - Merge logic (last-write-wins)
 * - Auth token handling
 * - Graceful error handling (never loses local data)
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { notesApi, Note, SyncRequest } from '@/api/notes'
import { Tab, saveData, loadData } from '@/storage/local'
import { auth } from '@/config/firebase'
import { AuthUser } from './useAuth'

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error'

const SYNC_QUEUE_KEY = 'flownote_sync_queue'
const DEFAULT_DEBOUNCE_MS = 1500
const RETRY_DELAY_MS = 5000
const MAX_RETRIES = 3

interface SyncQueueItem {
  tab: Tab
  timestamp: number
}

interface SyncQueue {
  changes: Map<string, SyncQueueItem>
  deletions: Set<string>
}

interface UseSyncOptions {
  user: AuthUser | null
  tabs: Tab[]
  onTabsUpdate: (tabs: Tab[]) => void
  debounceMs?: number
}

interface UseSyncReturn {
  status: SyncStatus
  error: Error | null
  pendingChanges: number
  queueChange: (tab: Tab) => void
  queueDeletion: (tabId: string) => void
  triggerSync: () => void
}

/**
 * Load sync queue from localStorage
 */
function loadSyncQueue(): SyncQueue {
  try {
    const stored = localStorage.getItem(SYNC_QUEUE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      return {
        changes: new Map(Object.entries(parsed.changes || {})),
        deletions: new Set(parsed.deletions || []),
      }
    }
  } catch {
    // Ignore parse errors
  }
  return { changes: new Map(), deletions: new Set() }
}

/**
 * Save sync queue to localStorage
 */
function saveSyncQueue(queue: SyncQueue): void {
  try {
    const serialized = {
      changes: Object.fromEntries(queue.changes),
      deletions: Array.from(queue.deletions),
    }
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(serialized))
  } catch {
    // Ignore save errors
  }
}

/**
 * Clear sync queue from localStorage
 */
function clearSyncQueue(): void {
  try {
    localStorage.removeItem(SYNC_QUEUE_KEY)
  } catch {
    // Ignore errors
  }
}

/**
 * Convert Tab to Note format for API
 */
function tabToNoteInput(tab: Tab, order: number): { id?: string; name: string; content: string; order: number } {
  return {
    id: tab.id,
    name: tab.name,
    content: tab.content,
    order,
  }
}

/**
 * Convert Note to Tab format for local storage
 */
function noteToTab(note: Note): Tab {
  return {
    id: note.id,
    name: note.name,
    content: note.content,
    updatedAt: new Date(note.updatedAt).getTime(),
  }
}

/**
 * Get auth token from Firebase
 */
async function getAuthToken(): Promise<string | null> {
  const user = auth.currentUser
  if (!user) return null
  try {
    return await user.getIdToken()
  } catch {
    return null
  }
}

/**
 * Main sync hook
 */
export function useSync(options: UseSyncOptions): UseSyncReturn {
  const { user, tabs, onTabsUpdate, debounceMs = DEFAULT_DEBOUNCE_MS } = options

  const [status, setStatus] = useState<SyncStatus>(() => (navigator.onLine ? 'synced' : 'offline'))
  const [error, setError] = useState<Error | null>(null)
  const [queue, setQueue] = useState<SyncQueue>(() => loadSyncQueue())

  const debounceTimerRef = useRef<number | null>(null)
  const retryTimerRef = useRef<number | null>(null)
  const retryCountRef = useRef(0)
  const isSyncingRef = useRef(false)

  const pendingChanges = queue.changes.size + queue.deletions.size

  // Update offline status based on navigator.onLine
  useEffect(() => {
    const handleOnline = () => {
      setStatus('synced')
      // Trigger sync when coming back online
      if (user && pendingChanges > 0) {
        performSync()
      }
    }

    const handleOffline = () => {
      setStatus('offline')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Set initial status
    if (!navigator.onLine) {
      setStatus('offline')
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [user, pendingChanges])

  // Save queue to localStorage whenever it changes
  useEffect(() => {
    saveSyncQueue(queue)
    // Also save tabs to localStorage to preserve local data
    if (tabs.length > 0) {
      const data = loadData()
      data.tabs = tabs
      saveData(data)
    }
  }, [queue, tabs])

  /**
   * Perform the actual sync operation
   */
  const performSync = useCallback(async () => {
    if (!user || isSyncingRef.current) return
    if (!navigator.onLine) {
      setStatus('offline')
      return
    }

    const token = await getAuthToken()
    if (!token) {
      setError(new Error('Not authenticated'))
      return
    }

    isSyncingRef.current = true
    setStatus('syncing')
    setError(null)

    try {
      // First, fetch server notes to merge
      const serverNotes = await notesApi.listNotes(token)

      // Ensure tabs is an array
      const currentTabs = tabs || []

      // Build sync request from queue
      const notesToSync: SyncRequest['notes'] = []
      const localTabsMap = new Map(currentTabs.map((t) => [t.id, t]))

      // Add queued changes
      queue.changes.forEach((item, id) => {
        const tab = item.tab
        // Check if server has a newer version
        const serverNote = serverNotes.find((n) => n.id === id)
        if (serverNote) {
          const serverTime = new Date(serverNote.updatedAt).getTime()
          if (item.timestamp > serverTime) {
            // Local is newer, push to server
            notesToSync.push(tabToNoteInput(tab, currentTabs.findIndex((t) => t.id === id)))
          }
          // else server is newer, we'll use server version
        } else {
          // New local note, create on server
          notesToSync.push(tabToNoteInput(tab, currentTabs.findIndex((t) => t.id === id)))
        }
      })

      // Add any local tabs not in queue but modified
      currentTabs.forEach((tab, index) => {
        if (!queue.changes.has(tab.id)) {
          const serverNote = serverNotes.find((n) => n.id === tab.id)
          if (!serverNote) {
            // Local only note, sync to server
            notesToSync.push(tabToNoteInput(tab, index))
          }
        }
      })

      const syncRequest: SyncRequest = {
        notes: notesToSync,
        deletedIds: Array.from(queue.deletions),
      }

      // Only sync if there's something to sync
      if (notesToSync.length > 0 || queue.deletions.size > 0) {
        await notesApi.syncNotes(syncRequest, token)
      }

      // Merge server notes with local (server notes not in local)
      const mergedTabs: Tab[] = [...currentTabs]
      serverNotes.forEach((serverNote) => {
        const localTab = localTabsMap.get(serverNote.id)
        if (!localTab) {
          // Server has a note we don't have locally
          mergedTabs.push(noteToTab(serverNote))
        } else {
          // Check if server is newer
          const localItem = queue.changes.get(serverNote.id)
          const localTime = localItem?.timestamp || localTab.updatedAt
          const serverTime = new Date(serverNote.updatedAt).getTime()
          if (serverTime > localTime) {
            // Server is newer, update local
            const index = mergedTabs.findIndex((t) => t.id === serverNote.id)
            if (index >= 0) {
              mergedTabs[index] = noteToTab(serverNote)
            }
          }
        }
      })

      // Update tabs with merged data
      if (JSON.stringify(mergedTabs) !== JSON.stringify(currentTabs)) {
        onTabsUpdate(mergedTabs)
      }

      // Clear queue on success
      setQueue({ changes: new Map(), deletions: new Set() })
      clearSyncQueue()
      setStatus('synced')
      retryCountRef.current = 0
    } catch (err) {
      console.error('Sync failed:', err)
      setError(err instanceof Error ? err : new Error('Sync failed'))

      // Schedule retry
      if (retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current++
        retryTimerRef.current = window.setTimeout(() => {
          performSync()
        }, RETRY_DELAY_MS)
      } else {
        setStatus('error')
      }
    } finally {
      isSyncingRef.current = false
    }
  }, [user, tabs, queue, onTabsUpdate])

  /**
   * Queue a change for syncing (debounced)
   */
  const queueChange = useCallback(
    (tab: Tab) => {
      // Always save locally first
      const data = loadData()
      const tabIndex = data.tabs.findIndex((t) => t.id === tab.id)
      if (tabIndex >= 0) {
        data.tabs[tabIndex] = tab
      } else {
        data.tabs.push(tab)
      }
      saveData(data)

      // Add to queue
      setQueue((prev) => {
        const newChanges = new Map(prev.changes)
        newChanges.set(tab.id, { tab, timestamp: Date.now() })
        return { ...prev, changes: newChanges }
      })

      // Don't sync if no user
      if (!user) return

      // Clear existing debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      // Set new debounce timer
      debounceTimerRef.current = window.setTimeout(() => {
        performSync()
      }, debounceMs)
    },
    [user, debounceMs, performSync]
  )

  /**
   * Queue a deletion for syncing
   */
  const queueDeletion = useCallback(
    (tabId: string) => {
      setQueue((prev) => {
        const newChanges = new Map(prev.changes)
        newChanges.delete(tabId) // Remove from changes if present
        const newDeletions = new Set(prev.deletions)
        newDeletions.add(tabId)
        return { changes: newChanges, deletions: newDeletions }
      })

      // Don't sync if no user
      if (!user) return

      // Clear existing debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      // Set new debounce timer
      debounceTimerRef.current = window.setTimeout(() => {
        performSync()
      }, debounceMs)
    },
    [user, debounceMs, performSync]
  )

  /**
   * Manually trigger a sync
   */
  const triggerSync = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    performSync()
  }, [performSync])

  // Initial sync on mount/user change
  useEffect(() => {
    if (user && navigator.onLine) {
      performSync()
    }
  }, [user])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current)
      }
    }
  }, [])

  return {
    status,
    error,
    pendingChanges,
    queueChange,
    queueDeletion,
    triggerSync,
  }
}
