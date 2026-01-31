/**
 * API Client with authentication support
 *
 * Provides a simple fetch wrapper that:
 * - Adds auth token to requests
 * - Handles JSON serialization
 * - Provides consistent error handling
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  status: number
  data?: unknown

  constructor(message: string, status: number, data?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  token?: string
}

async function request<T>(url: string, options: RequestOptions): Promise<T> {
  const headers: Record<string, string> = {}

  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`
  }

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  const fetchOptions: RequestInit = {
    method: options.method,
    headers,
  }

  if (options.body !== undefined) {
    fetchOptions.body = JSON.stringify(options.body)
  }

  const response = await fetch(url, fetchOptions)

  if (!response.ok) {
    let errorMessage = 'Request failed'
    let errorData: unknown

    try {
      errorData = await response.json()
      errorMessage = (errorData as { error?: string })?.error || errorMessage
    } catch {
      // JSON parsing failed, use default message
    }

    throw new ApiError(errorMessage, response.status, errorData)
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return null as T
  }

  return response.json()
}

export interface ApiClient {
  get<T>(path: string, token?: string): Promise<T>
  post<T>(path: string, body: unknown, token?: string): Promise<T>
  put<T>(path: string, body: unknown, token?: string): Promise<T>
  delete<T>(path: string, token?: string): Promise<T>
}

/**
 * Create an API client with the given base URL
 */
export function createApiClient(baseUrl: string): ApiClient {
  return {
    async get<T>(path: string, token?: string): Promise<T> {
      return request<T>(`${baseUrl}${path}`, { method: 'GET', token })
    },

    async post<T>(path: string, body: unknown, token?: string): Promise<T> {
      return request<T>(`${baseUrl}${path}`, { method: 'POST', body, token })
    },

    async put<T>(path: string, body: unknown, token?: string): Promise<T> {
      return request<T>(`${baseUrl}${path}`, { method: 'PUT', body, token })
    },

    async delete<T>(path: string, token?: string): Promise<T> {
      return request<T>(`${baseUrl}${path}`, { method: 'DELETE', token })
    },
  }
}

/**
 * Default API client using the configured base URL
 */
export const apiClient = createApiClient(API_BASE_URL)
