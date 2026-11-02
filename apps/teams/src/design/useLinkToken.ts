'use client'
// GENERATED from packages/design by scripts/sync-design.mjs. Do not edit here.

import { useEffect, useSyncExternalStore } from 'react'
import { clearLinkToken, readLinkToken } from './marketing'

// Read once per page load: the address bar is cleared right after, so a later read would find nothing.
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
  useEffect(() => {
    clearLinkToken()
    return () => {
      cached = undefined
    }
  }, [])
  return token
}
