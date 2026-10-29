import React, { useState } from 'react'
import { ArchitectureDiagram, CostTable, EvalResults, PageHeader, RiskMatrix, Tabs } from '../ds'
import { ARCH_EDGES, ARCH_NODES, COST_LINES, EVAL_CHECKS, RISKS } from '../ds/sample/teams'
import { Doc } from './Doc'

export function DataDocs() {
  const [sel, setSel] = useState<string | null>(null)
  const [overlay, setOverlay] = useState<'zones' | 'pii' | 'cost'>('zones')
  const [cell, setCell] = useState<[number, number] | null>(null)
  return (
    <div>
      <PageHeader title="Data & diagrams" description="Comparative data takes tables; structure takes diagrams. Every figure carries its evidence state." />
      <Doc
        name="ArchitectureDiagram"
        usage="Layered architecture with security boundaries, PII data flow and per-node costs as overlays. Click a node to isolate its connections. Becomes a layer list below md."
        props={[
          ['nodes / edges', 'ArchNode[] / ArchEdge[]'],
          ['showZones · highlightPii · showCosts', 'overlay toggles'],
          ['selected / onSelect', 'controlled node selection'],
        ]}
      >
        <Tabs
          variant="segmented"
          className="mb-4"
          value={overlay}
          onChange={(v) => setOverlay(v as typeof overlay)}
          tabs={[
            { value: 'zones', label: 'Security boundaries' },
            { value: 'pii', label: 'PII data flow' },
            { value: 'cost', label: 'Costs' },
          ]}
        />
        <ArchitectureDiagram nodes={ARCH_NODES} edges={ARCH_EDGES} selected={sel} onSelect={setSel} showZones={overlay === 'zones'} highlightPii={overlay === 'pii'} showCosts={overlay === 'cost'} />
      </Doc>
      <Doc name="CostTable" usage="Monthly cost lines as ranges with their driver. The total is labelled estimated unless every line is verified.">
        <CostTable lines={COST_LINES} />
      </Doc>
      <Doc name="RiskMatrix" usage="Likelihood × impact. Cells are filters for the risk register beside it.">
        <div className="max-w-xs">
          <RiskMatrix risks={RISKS} selected={cell} onSelect={setCell} />
        </div>
      </Doc>
      <Doc name="EvalResults" usage="Evaluation plan and results in one list. Pass/fail colour appears only on executed (verified) checks; planned checks stay neutral.">
        <EvalResults checks={EVAL_CHECKS} />
      </Doc>
    </div>
  )
}
