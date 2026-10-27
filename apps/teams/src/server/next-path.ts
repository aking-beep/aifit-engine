/** Only same-site relative paths may be redirect targets, so `?next=` cannot send someone off-site. */
export function safeNext(raw: unknown, fallback = '/workspace'): string {
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\') || raw.length > 500) return fallback;
  return raw;
}
