import React from 'react'

/** Documentation block: name, usage guidance, live example, and props. */
export function Doc({ name, usage, props, children }: { name: string; usage: string; props?: [string, string][]; children: React.ReactNode }) {
  return (
    <section className="border-t border-line py-8 first:border-t-0 first:pt-0">
      <div className="mb-4 grid gap-1 md:grid-cols-[220px_1fr] md:gap-6">
        <h2 className="font-mono text-label-md text-fg">{name}</h2>
        <p className="text-body-sm text-fg-muted">{usage}</p>
      </div>
      <div className="rounded-md border border-line bg-canvas p-4 sm:p-6">{children}</div>
      {props && (
        <dl className="mt-3 grid gap-x-6 gap-y-1 text-body-sm sm:grid-cols-[160px_1fr]">
          {props.map(([k, v]) => (
            <React.Fragment key={k}>
              <dt className="font-mono text-code-sm text-fg-2">{k}</dt>
              <dd className="text-fg-muted">{v}</dd>
            </React.Fragment>
          ))}
        </dl>
      )}
    </section>
  )
}
