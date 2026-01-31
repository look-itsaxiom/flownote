import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createApiClient, ApiError } from './client'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('createApiClient', () => {
    it('creates client with base URL', () => {
      const client = createApiClient('https://api.example.com')
      expect(client).toBeDefined()
      expect(typeof client.get).toBe('function')
      expect(typeof client.post).toBe('function')
      expect(typeof client.put).toBe('function')
      expect(typeof client.delete).toBe('function')
    })

    it('includes auth token in request headers', async () => {
      const client = createApiClient('https://api.example.com')
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: 'test' }),
      })

      await client.get('/test', 'test-token-123')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token-123',
          }),
        })
      )
    })

    it('sets Content-Type header for JSON requests', async () => {
      const client = createApiClient('https://api.example.com')
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: 'test' }),
      })

      await client.post('/test', { name: 'test' }, 'token')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      )
    })

    it('makes GET request correctly', async () => {
      const client = createApiClient('https://api.example.com')
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ notes: [] }),
      })

      const result = await client.get('/notes', 'token')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/notes',
        expect.objectContaining({ method: 'GET' })
      )
      expect(result).toEqual({ notes: [] })
    })

    it('makes POST request with body', async () => {
      const client = createApiClient('https://api.example.com')
      const noteData = { name: 'Test Note', content: 'Hello' }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: '123', ...noteData }),
      })

      const result = await client.post('/notes', noteData, 'token')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/notes',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(noteData),
        })
      )
      expect(result).toEqual({ id: '123', ...noteData })
    })

    it('makes PUT request with body', async () => {
      const client = createApiClient('https://api.example.com')
      const updateData = { name: 'Updated Note' }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: '123', ...updateData }),
      })

      const result = await client.put('/notes/123', updateData, 'token')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/notes/123',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(updateData),
        })
      )
      expect(result).toEqual({ id: '123', ...updateData })
    })

    it('makes DELETE request correctly', async () => {
      const client = createApiClient('https://api.example.com')
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: () => Promise.resolve(null),
      })

      await client.delete('/notes/123', 'token')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/notes/123',
        expect.objectContaining({ method: 'DELETE' })
      )
    })
  })

  describe('error handling', () => {
    it('throws ApiError on non-ok response', async () => {
      const client = createApiClient('https://api.example.com')
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Unauthorized' }),
      })

      await expect(client.get('/notes', 'invalid-token')).rejects.toThrow(ApiError)
    })

    it('includes status code in ApiError', async () => {
      const client = createApiClient('https://api.example.com')
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ error: 'Forbidden' }),
      })

      try {
        await client.get('/notes', 'token')
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError)
        expect((error as ApiError).status).toBe(403)
      }
    })

    it('includes error message from response', async () => {
      const client = createApiClient('https://api.example.com')
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Invalid note data' }),
      })

      try {
        await client.post('/notes', {}, 'token')
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError)
        expect((error as ApiError).message).toBe('Invalid note data')
      }
    })

    it('handles network errors', async () => {
      const client = createApiClient('https://api.example.com')
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      await expect(client.get('/notes', 'token')).rejects.toThrow('Network error')
    })

    it('handles JSON parse errors gracefully', async () => {
      const client = createApiClient('https://api.example.com')
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('Invalid JSON')),
      })

      try {
        await client.get('/notes', 'token')
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError)
        expect((error as ApiError).status).toBe(500)
      }
    })
  })

  describe('request without auth', () => {
    it('works without auth token for public endpoints', async () => {
      const client = createApiClient('https://api.example.com')
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'ok' }),
      })

      await client.get('/health')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/health',
        expect.objectContaining({
          headers: expect.not.objectContaining({
            Authorization: expect.any(String),
          }),
        })
      )
    })
  })
})
