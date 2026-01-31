import { describe, it, expect, vi, beforeEach } from 'vitest'
import { notesApi, Note, SyncRequest, SyncResponse } from './notes'
import * as client from './client'

// Mock the client module
vi.mock('./client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.status = status
    }
  },
}))

const mockClient = client.apiClient as {
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
  put: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}

describe('Notes API', () => {
  const mockToken = 'test-auth-token'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('listNotes', () => {
    it('fetches all notes for user', async () => {
      const mockNotes: Note[] = [
        { id: '1', name: 'Note 1', content: 'Content 1', order: 0, createdAt: '', updatedAt: '' },
        { id: '2', name: 'Note 2', content: 'Content 2', order: 1, createdAt: '', updatedAt: '' },
      ]
      mockClient.get.mockResolvedValueOnce({ notes: mockNotes })

      const result = await notesApi.listNotes(mockToken)

      expect(mockClient.get).toHaveBeenCalledWith('/api/notes', mockToken)
      expect(result).toEqual(mockNotes)
    })

    it('returns empty array when no notes', async () => {
      mockClient.get.mockResolvedValueOnce({ notes: [] })

      const result = await notesApi.listNotes(mockToken)

      expect(result).toEqual([])
    })
  })

  describe('getNote', () => {
    it('fetches a single note by ID', async () => {
      const mockNote: Note = {
        id: '123',
        name: 'Test Note',
        content: 'Test content',
        order: 0,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-02',
      }
      mockClient.get.mockResolvedValueOnce(mockNote)

      const result = await notesApi.getNote('123', mockToken)

      expect(mockClient.get).toHaveBeenCalledWith('/api/notes/123', mockToken)
      expect(result).toEqual(mockNote)
    })
  })

  describe('createNote', () => {
    it('creates a new note', async () => {
      const newNote = { name: 'New Note', content: 'New content', order: 0 }
      const createdNote: Note = {
        id: '456',
        ...newNote,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      }
      mockClient.post.mockResolvedValueOnce(createdNote)

      const result = await notesApi.createNote(newNote, mockToken)

      expect(mockClient.post).toHaveBeenCalledWith('/api/notes', newNote, mockToken)
      expect(result).toEqual(createdNote)
    })

    it('includes content when creating note', async () => {
      const newNote = { name: 'Note', content: 'test = 123\nresult = test * 2', order: 1 }
      mockClient.post.mockResolvedValueOnce({ id: '1', ...newNote })

      await notesApi.createNote(newNote, mockToken)

      expect(mockClient.post).toHaveBeenCalledWith(
        '/api/notes',
        expect.objectContaining({ content: newNote.content }),
        mockToken
      )
    })
  })

  describe('updateNote', () => {
    it('updates an existing note', async () => {
      const updates = { name: 'Updated Name', content: 'Updated content' }
      const updatedNote: Note = {
        id: '123',
        name: 'Updated Name',
        content: 'Updated content',
        order: 0,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-02',
      }
      mockClient.put.mockResolvedValueOnce(updatedNote)

      const result = await notesApi.updateNote('123', updates, mockToken)

      expect(mockClient.put).toHaveBeenCalledWith('/api/notes/123', updates, mockToken)
      expect(result).toEqual(updatedNote)
    })

    it('can update just content', async () => {
      const updates = { content: 'Only content changed' }
      mockClient.put.mockResolvedValueOnce({ id: '123', ...updates })

      await notesApi.updateNote('123', updates, mockToken)

      expect(mockClient.put).toHaveBeenCalledWith('/api/notes/123', updates, mockToken)
    })
  })

  describe('deleteNote', () => {
    it('deletes a note', async () => {
      mockClient.delete.mockResolvedValueOnce(undefined)

      await notesApi.deleteNote('123', mockToken)

      expect(mockClient.delete).toHaveBeenCalledWith('/api/notes/123', mockToken)
    })
  })

  describe('syncNotes', () => {
    it('performs bulk sync with notes and deleted IDs', async () => {
      const syncRequest: SyncRequest = {
        notes: [
          { id: '1', name: 'Note 1', content: 'Content 1', order: 0 },
          { name: 'New Note', content: 'Content', order: 1 }, // No ID = new note
        ],
        deletedIds: ['old-id-1', 'old-id-2'],
      }

      const syncResponse: SyncResponse = {
        created: [{ id: '2', name: 'New Note', content: 'Content', order: 1, createdAt: '', updatedAt: '' }],
        updated: [{ id: '1', name: 'Note 1', content: 'Content 1', order: 0, createdAt: '', updatedAt: '' }],
        deleted: ['old-id-1', 'old-id-2'],
      }

      mockClient.post.mockResolvedValueOnce(syncResponse)

      const result = await notesApi.syncNotes(syncRequest, mockToken)

      expect(mockClient.post).toHaveBeenCalledWith('/api/notes/sync', syncRequest, mockToken)
      expect(result).toEqual(syncResponse)
    })

    it('handles empty sync request', async () => {
      const syncRequest: SyncRequest = { notes: [], deletedIds: [] }
      const syncResponse: SyncResponse = { created: [], updated: [], deleted: [] }

      mockClient.post.mockResolvedValueOnce(syncResponse)

      const result = await notesApi.syncNotes(syncRequest, mockToken)

      expect(result).toEqual(syncResponse)
    })
  })
})
