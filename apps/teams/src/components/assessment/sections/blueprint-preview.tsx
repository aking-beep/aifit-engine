'use client';

import { useState } from 'react';
import { DownloadPreview, type GeneratedFile } from '@/design';

/**
 * Preview of the real blueprint files. Download goes through the server route,
 * which checks the entitlement again; nothing is assembled in the browser.
 */
export function BlueprintPreview({ files, downloadHref, canDownload, meta }: { files: GeneratedFile[]; downloadHref: string | null; canDownload: boolean; meta: string }) {
  const [error, setError] = useState<string | null>(null);
  async function download() {
    if (!downloadHref) return;
    setError(null);
    const res = await fetch(downloadHref, { credentials: 'same-origin' });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return setError(body.error ?? 'Download failed.');
    }
    const blob = await res.blob();
    const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? 'blueprint.md';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="space-y-2">
      <DownloadPreview name="blueprint" files={files} meta={meta} canDownload={canDownload && Boolean(downloadHref)} onDownload={download} />
      {error ? <p role="alert" className="text-body-sm text-danger">{error}</p> : null}
    </div>
  );
}
