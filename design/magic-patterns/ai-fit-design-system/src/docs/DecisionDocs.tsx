import React, { useState } from 'react'
import { Button, EvidenceLabel, PageHeader, ReasonList, RecommendationCard, RiskBadge, StageRail, VerdictChip } from '../ds'
import type { StageId } from '../ds'
import { SAMPLE_TOOLS } from '../ds/sample/consumer'
import { SUITABILITY_REASONS } from '../ds/sample/teams'
import { Doc } from './Doc'

export function DecisionDocs() {
  const [stage, setStage] = useState<StageId>('decide')
  const [tools, setTools] = useState(SAMPLE_TOOLS.slice(0, 2))
  return (
    <div>
      <PageHeader title="Decision & evidence" description="The components that make AI Fit explainable: what was decided, why, and how sure we are." />
      <Doc
        name="StageRail"
        usage="Top of every assessment and result in both products. Click a stage to navigate. Below md it collapses to a stage name and progress bar."
        props={[
          ['current', 'StageId — the active stage'],
          ['completed', 'StageId[] — shown with a check'],
          ['onSelect', 'optional; makes stages navigable'],
        ]}
      >
        <StageRail current={stage} completed={['understand']} onSelect={setStage} />
      </Doc>
      <Doc name="EvidenceLabel" usage="Next to every figure, price, model metric and claim. Shape + colour + word; hover for the definition. Pass asOf for dated sources." props={[['kind', 'verified | estimated | assumption | recommendation | untested'], ['asOf', 'optional date string'], ['compact', 'mark only, for dense tables']]}>
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <EvidenceLabel kind="verified" asOf="2025-06" />
          <EvidenceLabel kind="estimated" />
          <EvidenceLabel kind="assumption" />
          <EvidenceLabel kind="recommendation" />
          <EvidenceLabel kind="untested" />
        </div>
      </Doc>
      <Doc name="VerdictChip" usage="The outcome of the Decide stage. Use size md in result headers, sm in tables. Never pair No AI with warning colours." props={[['verdict', 'no-ai | software | automation | buy | build'], ['size', 'sm | md']]}>
        <div className="flex flex-wrap gap-2">
          {(['no-ai', 'software', 'automation', 'buy', 'build'] as const).map((v) => (
            <VerdictChip key={v} verdict={v} size="md" />
          ))}
        </div>
      </Doc>
      <Doc name="ReasonList" usage="Every factor behind a decision, sorted by weight, with direction and evidence. Inline on Consumer, inside a drawer on Teams.">
        <ReasonList reasons={SUITABILITY_REASONS.slice(0, 4)} />
      </Doc>
      <Doc name="RiskBadge" usage="Bar count + word for risk level. Colour only reinforces; it never carries the meaning alone.">
        <div className="flex flex-wrap gap-6">
          <RiskBadge level="low" />
          <RiskBadge level="medium" />
          <RiskBadge level="high" />
          <RiskBadge level="critical" />
        </div>
      </Doc>
      <Doc
        name="RecommendationCard"
        usage="Consumer tool recommendation. Tool, best use, why it fits, pricing, setup difficulty, privacy, alternatives, configure action. Footers align across a row."
        props={[
          ['rec', 'ToolRecommendation'],
          ['onConfigure', 'opens the configuration generator'],
          ['onToggleSave', 'save / unsave'],
        ]}
      >
        <div className="grid gap-4 md:grid-cols-2">
          {tools.map((t, i) => (
            <RecommendationCard key={t.id} rec={t} rank={i + 1} onToggleSave={() => setTools((ts) => ts.map((x) => (x.id === t.id ? { ...x, saved: !x.saved } : x)))} />
          ))}
        </div>
      </Doc>
      <Doc name="Button" usage="One primary per region. Secondary for everything else, ghost in toolbars, danger only for destructive actions.">
        <div className="flex flex-wrap gap-2">
          <Button variant="primary">Generate blueprint</Button>
          <Button>Compare</Button>
          <Button variant="ghost">Cancel</Button>
          <Button variant="danger">Delete workload</Button>
          <Button loading>Saving</Button>
        </div>
      </Doc>
    </div>
  )
}
