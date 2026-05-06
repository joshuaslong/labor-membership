'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { GoogleAnalytics } from '@next/third-parties/google'
import { getStoredConsent } from './CookieConsent'

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID

export default function AnalyticsGate() {
  const pathname = usePathname()
  const [consent, setConsent] = useState(null)

  useEffect(() => {
    setConsent(getStoredConsent())
    const onChange = () => setConsent(getStoredConsent())
    window.addEventListener('ga-consent-change', onChange)
    return () => window.removeEventListener('ga-consent-change', onChange)
  }, [])

  if (!GA_ID) return null
  if (consent !== 'granted') return null
  // Admin sessions are excluded so member analytics aren't polluted by staff
  // activity. Admins still surface in Sentry breadcrumbs / server logs.
  if (pathname?.startsWith('/admin')) return null

  return <GoogleAnalytics gaId={GA_ID} />
}
