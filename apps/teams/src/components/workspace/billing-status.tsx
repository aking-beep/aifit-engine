'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from './ui';

/**
 * After Stripe redirects back. The redirect itself proves nothing, so this
 * polls the server for what the verified webhook recorded.
 */
export function BillingStatus({ status, sessionId }: { status: string | null; sessionId: string | null }) {
  const [state, setState] = useState<string>(status === 'cancelled' ? 'cancelled' : sessionId ? 'checking' : 'none');

  useEffect(() => {
    if (state !== 'checking' || !sessionId) return;
    let tries = 0;
    const timer = setInterval(async () => {
      tries++;
      const res = await api<{ checkout: { status: string } | null }>(`/api/billing/status?session_id=${encodeURIComponent(sessionId)}`);
      const s = res.data.checkout?.status;
      if (s && s !== 'pending') {
        setState(s);
        clearInterval(timer);
      } else if (tries >= 10) {
        setState(s === 'pending' ? 'pending' : 'unconfirmed');
        clearInterval(timer);
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [state, sessionId]);

  const message: Record<string, string> = {
    none: 'No checkout in progress.',
    checking: 'Confirming your payment with Stripe…',
    paid: 'Payment confirmed. Your purchase is now available in the workspace.',
    pending: 'Stripe has not confirmed the payment yet (some payment methods take longer). Access is granted as soon as it does.',
    unconfirmed: 'We have not received confirmation from Stripe yet. If you completed payment, it will appear shortly; nothing has been charged twice.',
    failed: 'The payment failed. Nothing was granted; you can try again from the workspace.',
    expired: 'The checkout expired before payment. Nothing was charged.',
    cancelled: 'Checkout was cancelled. Nothing was charged.',
  };
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-200" aria-live="polite">{message[state] ?? message.unconfirmed}</p>
      <Link href="/workspace" className="text-sm text-signal underline underline-offset-2">Back to the workspace</Link>
    </div>
  );
}
