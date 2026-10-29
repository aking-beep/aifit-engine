'use client';

import { useRef, useState } from 'react';

const FOCUS =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

/**
 * The report's one next action: take the link to the meeting.
 *
 * Nothing is stored, so the URL is the document. Clipboard access can be
 * refused (insecure origin, permissions, an old browser), so the fallback is
 * a selected read-only field the person can copy by hand — never a silent
 * failure that leaves them thinking it worked.
 */
export function CopyReportLink() {
  const [state, setState] = useState<'idle' | 'copied' | 'manual'>('idle');
  const [href, setHref] = useState('');
  const field = useRef<HTMLInputElement>(null);

  async function copy() {
    const url = window.location.href;
    setHref(url);
    try {
      await navigator.clipboard.writeText(url);
      setState('copied');
    } catch {
      setState('manual');
      requestAnimationFrame(() => field.current?.select());
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={copy}
        className={'min-h-10 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent transition hover:bg-accent/90 ' + FOCUS}
      >
        {state === 'copied' ? 'Link copied' : 'Copy link to this report'}
      </button>
      <p className="mt-2 text-xs leading-relaxed text-fg-muted" aria-live="polite">
        {state === 'manual'
          ? 'Your browser blocked the clipboard. The link is selected below: copy it by hand.'
          : 'The link is the document — nothing is stored, so bring this URL to the meeting.'}
      </p>
      {state === 'manual' && (
        <label className="mt-2 block">
          <span className="sr-only">Report link</span>
          <input
            ref={field}
            readOnly
            value={href}
            onFocus={(e) => e.currentTarget.select()}
            className={'w-full rounded-md border border-line bg-surface px-3 py-2 font-mono text-2xs text-fg-2 ' + FOCUS}
          />
        </label>
      )}
    </div>
  );
}

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={'min-h-10 rounded-lg border border-line-strong px-4 py-2 text-sm text-fg transition hover:border-line-strong hover:bg-sunken ' + FOCUS}
    >
      Print or save as PDF
    </button>
  );
}
