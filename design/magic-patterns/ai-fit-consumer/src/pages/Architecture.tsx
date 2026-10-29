import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArchitectureDiagram, Button, EvidenceLabel, KIND_LABEL, KeyValue, ZONE_LABEL, cn, formatMoney, formatRange } from '../ds'
import { ARCH_EDGES, ARCH_NODES, GOVERNANCE, MODELS } from '../ds/sample/teams'
import { WorkloadHeader } from '../layout/WorkloadHeader'

type Overlay = 'zones' | 'pii' | 'cost'

/** Architecture workspace: interactive diagram + contextual detail panel. */
export function Architecture() {
  const nav = useNavigate()
  const [sel, setSel] = useState<string | null>(null)
  const [overlays, setOverlays] = useState<Overlay[]>(['zones'])
  const node = ARCH_NODES.find((n) => n.id === sel)
  const toggle = (o: Overlay) => setOverlays((s) => (s.includes(o) ? s.filter((x) => x !== o) : [...s, o]))
  const low = ARCH_NODES.reduce((s, n) => s + (n.monthly?.low ?? 0), 0)
  const high = ARCH_NODES.reduce((s, n) => s + (n.monthly?.high ?? 0), 0)
  const model = MODELS.find((m) => m.recommended)!

  return (
    <div>
      <WorkloadHeader
        stage="configure"
        title="Architecture workspace"
        description="Recommended architecture for the Buy + guardrails verdict. Click a component to see its role, controls and cost."
        actions={
          <>
            <Button onClick={() => nav('/app/models')}>Compare models</Button>
            <Button variant="primary" onClick={() => nav('/app/blueprint')}>
              Generate blueprint
            </Button>
          </>
        }
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="rounded-md border border-line bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2.5">
            <div role="group" aria-label="Overlays" className="flex flex-wrap gap-1.5">
              {(
                [
                  ['zones', 'Security boundaries'],
                  ['pii', 'PII data flow'],
                  ['cost', 'Costs'],
                ] as [Overlay, string][]
              ).map(([o, l]) => (
                <button
                  key={o}
                  aria-pressed={overlays.includes(o)}
                  onClick={() => toggle(o)}
                  className={cn('h-7 whitespace-nowrap rounded-xs border px-2.5 text-label-md transition-colors duration-150', overlays.includes(o) ? 'border-fg bg-fg text-canvas' : 'border-line text-fg-muted hover:text-fg')}
                >
                  {l}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-4 text-label-sm text-fg-muted">
              <span className="flex items-center gap-1.5"><span className="h-3 w-0.5 rounded bg-accent" /> Model</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-0.5 rounded bg-warn" /> Guardrail</span>
              {overlays.includes('pii') && <span className="flex items-center gap-1.5"><span className="h-0 w-4 border-t-2 border-dashed border-warn" /> Carries PII</span>}
            </div>
          </div>
          <div className="p-4">
            <ArchitectureDiagram nodes={ARCH_NODES} edges={ARCH_EDGES} selected={sel} onSelect={setSel} showZones={overlays.includes('zones')} highlightPii={overlays.includes('pii')} showCosts={overlays.includes('cost')} />
          </div>
        </div>

        <aside className="rounded-md border border-line bg-surface">
          {node ? (
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-label-sm text-fg-muted">{KIND_LABEL[node.kind]}</p>
                  <h2 className="text-headline-md text-fg">{node.label}</h2>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setSel(null)}>
                  Clear
                </Button>
              </div>
              <p className="mt-2 text-body-sm text-fg-2">{node.detail}</p>
              <dl className="mt-4">
                <KeyValue label="Zone">{ZONE_LABEL[node.zone]}</KeyValue>
                <KeyValue label="Monthly">{node.monthly ? <span className="font-mono">{formatRange(node.monthly)}</span> : '—'}</KeyValue>
                <KeyValue label="Evidence"><EvidenceLabel kind={node.evidence} /></KeyValue>
                <KeyValue label="Connections">{ARCH_EDGES.filter((e) => e.from === node.id || e.to === node.id).length}</KeyValue>
              </dl>
              {node.kind === 'model' && (
                <Button size="sm" className="mt-4" onClick={() => nav('/app/models')}>
                  Change model
                </Button>
              )}
            </div>
          ) : (
            <div>
              <section className="border-b border-line p-4">
                <p className="text-label-sm text-fg-muted">Estimated monthly</p>
                <p className="font-mono text-headline-md text-fg">
                  {formatMoney(low)}–{formatMoney(high)}
                </p>
                <EvidenceLabel kind="estimated" />
              </section>
              <section className="border-b border-line p-4">
                <h3 className="mb-2 text-title-md text-fg">Model selection</h3>
                <p className="text-body-sm text-fg">{model.name}</p>
                <p className="text-body-sm text-fg-muted">{model.provider}</p>
              </section>
              <section className="border-b border-line p-4">
                <h3 className="mb-2 text-title-md text-fg">Integrations</h3>
                <ul className="flex flex-col gap-1 text-body-sm text-fg-2">
                  <li>Zendesk — webhook in, API write-back</li>
                  <li>Order system — read-only lookup</li>
                  <li>Help center — nightly index</li>
                </ul>
              </section>
              <section className="p-4">
                <h3 className="mb-2 text-title-md text-fg">Governance controls</h3>
                <ul className="flex flex-col gap-1.5">
                  {GOVERNANCE.slice(0, 4).map((g) => (
                    <li key={g.control} className="flex items-start justify-between gap-3 text-body-sm">
                      <span className="text-fg-2">{g.control}</span>
                      <span className={cn('shrink-0 text-label-sm', g.status === 'gap' ? 'text-fg' : 'text-fg-muted')}>{g.status === 'met' ? 'Met' : g.status === 'partial' ? 'Partial' : 'Gap'}</span>
                    </li>
                  ))}
                </ul>
                <Button size="sm" variant="ghost" className="mt-3 -ml-2" onClick={() => nav('/app/governance')}>
                  Full governance assessment
                </Button>
              </section>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
