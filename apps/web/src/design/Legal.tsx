// GENERATED from packages/design by scripts/sync-design.mjs. Do not edit here.
import React from 'react'

/** Legal page shell. `draft` shows a notice that the text awaits review by counsel. */
export function LegalPage({ title, updated, draft = true, children }: { title: string; updated: string; draft?: boolean; children: React.ReactNode }) {
  return (
    <article className="mx-auto w-full max-w-3xl space-y-6 px-4 py-12 text-body-md text-fg-2 [&_h2]:mt-8 [&_h2]:text-title-md [&_h2]:text-fg [&_li]:ml-5 [&_li]:list-disc [&_p]:leading-relaxed">
      <header>
        <h1 className="text-headline-lg text-fg">{title}</h1>
        <p className="mt-1 text-body-sm text-fg-muted">Last updated {updated}</p>
      </header>
      {draft ? (
        <p role="note" className="rounded-md border border-warn/40 bg-warn/10 p-3 text-body-sm text-fg">
          Draft for review by counsel. This text has not yet been approved and may change before paid plans are offered.
        </p>
      ) : null}
      {children}
    </article>
  )
}
