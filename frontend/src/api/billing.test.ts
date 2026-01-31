import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createCheckoutSession, createPortalSession } from './billing'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('billing API', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('createCheckoutSession', () => {
    it('calls POST /api/billing/checkout with auth token', async () => {
      const mockResponse = {
        url: 'https://checkout.stripe.com/session123',
        sessionId: 'cs_test_123',
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const idToken = 'test-firebase-token'
      const result = await createCheckoutSession(idToken)

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch).toHaveBeenCalledWith('/api/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-firebase-token',
        },
        body: JSON.stringify({}),
      })
      expect(result).toEqual(mockResponse)
    })

    it('throws error when API call fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      })

      const idToken = 'invalid-token'
      await expect(createCheckoutSession(idToken)).rejects.toThrow(
        'Failed to create checkout session'
      )
    })

    it('throws error when network request fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const idToken = 'test-token'
      await expect(createCheckoutSession(idToken)).rejects.toThrow('Network error')
    })

    it('accepts optional priceId parameter', async () => {
      const mockResponse = {
        url: 'https://checkout.stripe.com/session123',
        sessionId: 'cs_test_123',
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const idToken = 'test-token'
      const priceId = 'price_pro_monthly'
      await createCheckoutSession(idToken, priceId)

      expect(mockFetch).toHaveBeenCalledWith('/api/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
        body: JSON.stringify({ priceId }),
      })
    })
  })

  describe('createPortalSession', () => {
    it('calls POST /api/billing/portal with auth token', async () => {
      const mockResponse = {
        url: 'https://billing.stripe.com/portal123',
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const idToken = 'test-firebase-token'
      const result = await createPortalSession(idToken)

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch).toHaveBeenCalledWith('/api/billing/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-firebase-token',
        },
      })
      expect(result).toEqual(mockResponse)
    })

    it('throws error when API call fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      })

      const idToken = 'test-token'
      await expect(createPortalSession(idToken)).rejects.toThrow(
        'Failed to create portal session'
      )
    })

    it('throws error when network request fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const idToken = 'test-token'
      await expect(createPortalSession(idToken)).rejects.toThrow('Network error')
    })
  })
})
