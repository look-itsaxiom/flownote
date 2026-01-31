/**
 * Notes API functions
 *
 * Provides typed functions for interacting with the notes backend API.
 * All functions require an auth token for authenticated requests.
 */

import { apiClient, ApiError } from './client'

export { ApiError }

/**
 * Note as returned from the server
 */
export interface Note {
  id: string
  name: string
  content: string
  order: number
  createdAt: string
  updatedAt: string
}

/**
 * Input for creating a new note
 */
export interface NoteInput {
  name: string
  content: string
  order: number
}

/**
 * Input for updating a note (all fields optional)
 */
export interface NoteUpdateInput {
  name?: string
  content?: string
  order?: number
}

/**
 * Sync request payload for bulk operations
 */
export interface SyncRequest {
  notes: Array<{
    id?: string // No ID means create new
    name: string
    content: string
    order: number
  }>
  deletedIds: string[]
}

/**
 * Sync response from the server
 */
export interface SyncResponse {
  created: Note[]
  updated: Note[]
  deleted: string[]
}

/**
 * Notes API methods
 */
export const notesApi = {
  /**
   * List all notes for the authenticated user
   */
  async listNotes(token: string): Promise<Note[]> {
    const response = await apiClient.get<{ notes: Note[] }>('/api/notes', token)
    return response.notes
  },

  /**
   * Get a single note by ID
   */
  async getNote(id: string, token: string): Promise<Note> {
    return apiClient.get<Note>(`/api/notes/${id}`, token)
  },

  /**
   * Create a new note
   */
  async createNote(note: NoteInput, token: string): Promise<Note> {
    return apiClient.post<Note>('/api/notes', note, token)
  },

  /**
   * Update an existing note
   */
  async updateNote(id: string, updates: NoteUpdateInput, token: string): Promise<Note> {
    return apiClient.put<Note>(`/api/notes/${id}`, updates, token)
  },

  /**
   * Delete a note
   */
  async deleteNote(id: string, token: string): Promise<void> {
    await apiClient.delete(`/api/notes/${id}`, token)
  },

  /**
   * Bulk sync notes (create, update, delete in one request)
   * Used for offline-first syncing
   */
  async syncNotes(request: SyncRequest, token: string): Promise<SyncResponse> {
    return apiClient.post<SyncResponse>('/api/notes/sync', request, token)
  },
}
