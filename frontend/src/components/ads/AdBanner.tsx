import { useEffect, useRef, useState } from 'react'
import {
  ADSENSE_CLIENT_ID,
  ADSENSE_SLOT_ID,
  ADSENSE_SCRIPT_URL,
  isAdSenseConfigured,
} from '@/config/adsense'

export type UserTier = 'free' | 'pro' | null | undefined

export interface AdBannerProps {
  /** User's subscription tier. Ads only shown for 'free' tier. */
  userTier: UserTier
  /** Optional additional CSS class */
  className?: string
  /** Show fallback content when ads fail to load */
  showFallback?: boolean
}

/**
 * AdBanner Component
 *
 * Displays Google AdSense ads for free tier users only.
 * Handles ad blockers gracefully without breaking the app.
 *
 * Security:
 * - Ad scripts loaded from official AdSense CDN only
 * - No user data passed to ad network
 */
export function AdBanner({ userTier, className = '', showFallback = false }: AdBannerProps) {
  const adRef = useRef<HTMLDivElement>(null)
  const [adError, setAdError] = useState(false)
  const [scriptLoaded, setScriptLoaded] = useState(false)

  // Only show ads for logged-in free tier users
  const shouldShowAd = userTier === 'free'

  // Load AdSense script
  useEffect(() => {
    if (!shouldShowAd) return
    if (!isAdSenseConfigured) {
      // In development mode without AdSense config, skip script loading
      setScriptLoaded(true)
      return
    }

    // Check if script is already loaded
    const existingScript = document.querySelector(
      `script[src^="${ADSENSE_SCRIPT_URL}"]`
    )
    if (existingScript) {
      setScriptLoaded(true)
      return
    }

    // Create and load the AdSense script
    const script = document.createElement('script')
    script.src = `${ADSENSE_SCRIPT_URL}?client=${ADSENSE_CLIENT_ID}`
    script.async = true
    script.crossOrigin = 'anonymous'

    script.onload = () => setScriptLoaded(true)
    script.onerror = () => {
      // Ad blocker likely blocked the script
      setAdError(true)
    }

    document.head.appendChild(script)

    return () => {
      // Don't remove script on cleanup - it should persist
    }
  }, [shouldShowAd])

  // Initialize ad unit after script loads
  useEffect(() => {
    if (!shouldShowAd || !scriptLoaded || !isAdSenseConfigured) return

    try {
      // Push ad configuration to AdSense
      const adsbygoogle = (window as unknown as { adsbygoogle?: unknown[] }).adsbygoogle
      if (adsbygoogle) {
        adsbygoogle.push({})
      }
    } catch (error) {
      // Ad blocker or other error - handle gracefully
      console.debug('AdSense initialization skipped:', error)
      setAdError(true)
    }
  }, [shouldShowAd, scriptLoaded])

  // Don't render for non-free users or when not logged in
  if (!shouldShowAd) {
    return null
  }

  const containerClassName = ['ad-banner', className].filter(Boolean).join(' ')

  // Development placeholder when AdSense is not configured
  if (!isAdSenseConfigured) {
    return (
      <div
        ref={adRef}
        className={containerClassName}
        data-testid="ad-banner"
        aria-label="Advertisement placeholder"
      >
        <div className="ad-banner__placeholder">
          <span className="ad-banner__placeholder-text">Ad Space</span>
          <span className="ad-banner__placeholder-subtitle">
            Configure VITE_ADSENSE_CLIENT_ID to show real ads
          </span>
        </div>
      </div>
    )
  }

  // Show fallback when ad fails to load (ad blocker)
  if (adError && showFallback) {
    return (
      <div
        ref={adRef}
        className={containerClassName}
        data-testid="ad-banner"
        aria-label="Support message"
      >
        <div className="ad-banner__fallback">
          <span className="ad-banner__fallback-text">
            Enjoying FlowNote? Consider upgrading to Pro for an ad-free experience.
          </span>
        </div>
      </div>
    )
  }

  // Real AdSense ad unit
  return (
    <div
      ref={adRef}
      className={containerClassName}
      data-testid="ad-banner"
      aria-label="Advertisement"
    >
      <ins
        className="adsbygoogle"
        style={{
          display: 'block',
          width: '100%',
          height: '90px',
        }}
        data-ad-client={ADSENSE_CLIENT_ID}
        data-ad-slot={ADSENSE_SLOT_ID}
        data-ad-format="horizontal"
        data-full-width-responsive="false"
      />
    </div>
  )
}

export default AdBanner
