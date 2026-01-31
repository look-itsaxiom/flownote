/**
 * Billing API functions for Stripe integration
 * These functions communicate with the backend billing endpoints
 */

export interface CheckoutSessionResponse {
  /** Stripe checkout session URL to redirect the user to */
  url: string
  /** Stripe checkout session ID */
  sessionId: string
}

export interface PortalSessionResponse {
  /** Stripe customer portal URL to redirect the user to */
  url: string
}

/**
 * Create a Stripe checkout session for subscription upgrade
 *
 * @param idToken - Firebase ID token for authentication
 * @param priceId - Optional Stripe price ID (defaults to standard Pro plan)
 * @returns Checkout session URL and ID
 * @throws Error if the API call fails
 */
export async function createCheckoutSession(
  idToken: string,
  priceId?: string
): Promise<CheckoutSessionResponse> {
  const response = await fetch('/api/billing/checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(priceId ? { priceId } : {}),
  })

  if (!response.ok) {
    throw new Error('Failed to create checkout session')
  }

  return response.json()
}

/**
 * Create a Stripe customer portal session for subscription management
 *
 * @param idToken - Firebase ID token for authentication
 * @returns Portal session URL
 * @throws Error if the API call fails
 */
export async function createPortalSession(
  idToken: string
): Promise<PortalSessionResponse> {
  const response = await fetch('/api/billing/portal', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
  })

  if (!response.ok) {
    throw new Error('Failed to create portal session')
  }

  return response.json()
}
