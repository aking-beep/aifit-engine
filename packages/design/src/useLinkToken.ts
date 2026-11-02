'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { clearLinkToken, readLinkToken } from './marketing'

// Read once per page load, because the address bar is cleared right after. The
// cache survives remounts (React Strict Mode mounts twice in development) and is
// dropped only by forgetLinkToken() once the token has been used.
let cached: string | null | undefined
const snapshot = () => (cached === undefined ? (cached = readLinkToken()) : cached)
const subscribe = () => () => {}

/**
 * The one-time token from an emailed link (`#token=`). `undefined` until the
 * browser has read it (the server never sees the fragment), then the token or
 * null. The address bar is cleared once it has been read.
 */
export function useLinkToken(): string | null | undefined {
  const token = useSyncExternalStore(subscribe, snapshot, () => undefined)
  useEffect(() => clearLinkToken(), [])
  return token
}

/** Drop the remembered token once it has been used, so a later visit starts fresh. */
export function forgetLinkToken(): void {
  cached = undefined
}
