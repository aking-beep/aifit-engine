export type ErrorCode =
  | 'unauthenticated' | 'forbidden' | 'not_found' | 'conflict' | 'invalid' | 'rate_limited' | 'payment_required' | 'unavailable';

const STATUS: Record<ErrorCode, number> = {
  unauthenticated: 401, forbidden: 403, not_found: 404, conflict: 409, invalid: 422, rate_limited: 429, payment_required: 402, unavailable: 503,
};

/** Every refusal the platform makes. Messages are safe to show to the caller. */
export class PlatformError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  constructor(code: ErrorCode, message: string) {
    super(message);
    this.code = code;
    this.status = STATUS[code];
  }
}
