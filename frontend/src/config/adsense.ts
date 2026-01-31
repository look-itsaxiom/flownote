/**
 * AdSense Configuration
 *
 * Environment variables:
 * - VITE_ADSENSE_CLIENT_ID: Your AdSense publisher ID (e.g., "ca-pub-1234567890")
 * - VITE_ADSENSE_SLOT_ID: The ad unit slot ID for this placement
 *
 * Security:
 * - Ad scripts are loaded only from official Google AdSense CDN
 * - No user data is passed to the ad network
 */

export const ADSENSE_CLIENT_ID = import.meta.env.VITE_ADSENSE_CLIENT_ID || ''
export const ADSENSE_SLOT_ID = import.meta.env.VITE_ADSENSE_SLOT_ID || ''

// Official Google AdSense script URL
export const ADSENSE_SCRIPT_URL = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'

// Check if we're in development mode (no real AdSense credentials)
export const isAdSenseConfigured = Boolean(ADSENSE_CLIENT_ID && ADSENSE_SLOT_ID)
