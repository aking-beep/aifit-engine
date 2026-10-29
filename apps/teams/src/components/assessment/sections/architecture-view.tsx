'use client';

import { useState } from 'react';
import type { ArchGraph } from '@aifit/deliverables';
import { ArchitectureDiagram, EvidenceLabel, KIND_LABEL, KeyValue, Toggle, ZONE_LABEL, formatRange } from '@/design';

/** The diagram with its overlays and a detail panel for the selected node. */
export function ArchitectureView({ graph }: { graph: ArchGraph }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [zones, setZones] = useState(true);
  const [pii, setPii] = useState(graph.sensitive.length > 0);
  const [costs, setCosts] = useState(false);
  const node = graph.nodes.find((n) => n.id === selected) ?? null;
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Toggle checked={zones} onChange={setZones} label="Trust boundaries" />
          <Toggle checked={pii} onChange={setPii} label="Sensitive data flow" />
          <Toggle checked={costs} onChange={setCosts} label="Run cost" />
        </div>
        <div className="overflow-x-auto rounded-md border border-line bg-surface p-3">
          <ArchitectureDiagram nodes={graph.nodes} edges={graph.edges} selected={selected} onSelect={setSelected} showZones={zones} showCosts={costs} highlightPii={pii} />
        </div>
      </div>
      <aside className="rounded-md border border-line bg-surface p-4" aria-live="polite">
        {node ? (
          <dl>
            <p className="mb-2 text-title-md text-fg">{node.label}</p>
            <KeyValue label="Kind">{KIND_LABEL[node.kind]}</KeyValue>
            <KeyValue label="Zone">{ZONE_LABEL[node.zone]}</KeyValue>
            {node.monthly ? <KeyValue label="Run cost">{formatRange(node.monthly)}</KeyValue> : null}
            <KeyValue label="Evidence"><EvidenceLabel kind={node.evidence} /></KeyValue>
            <p className="mt-3 text-body-sm text-fg-2">{node.detail}</p>
          </dl>
        ) : (
          <p className="text-body-sm text-fg-muted">Select a component in the diagram to see what it does, its trust zone and its evidence.</p>
        )}
      </aside>
    </div>
  );
}
