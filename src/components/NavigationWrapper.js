'use client'

import { usePathname } from 'next/navigation'

const WORKSPACE_PREFIXES = ['/workspace']

export default function NavigationWrapper({ children }) {
  const pathname = usePathname()
  const isWorkspaceRoute = WORKSPACE_PREFIXES.some(prefix => pathname.startsWith(prefix))

  if (isWorkspaceRoute) return null
  return children
}
