import React, { useState } from 'react'
import { ChoiceGroup, PageHeader, ProgressBar, ScoreRing, Select, Slider, Tabs, TextArea, TextInput, Toggle } from '../ds'
import { Doc } from './Doc'

export function InputDocs() {
  const [goal, setGoal] = useState<string[]>(['code'])
  const [constraints, setConstraints] = useState<string[]>(['privacy'])
  const [on, setOn] = useState(true)
  const [vol, setVol] = useState(12400)
  const [tab, setTab] = useState('overview')
  const [seg, setSeg] = useState('table')
  return (
    <div>
      <PageHeader title="Forms & assessment" description="Inputs share one control height (36px), one focus treatment, and inline errors that say how to fix the problem." />
      <Doc name="ChoiceGroup" usage="Assessment answers. Single select (radio) or multi (checkbox). Use size lg on Consumer, md on Teams." props={[['multiple', 'checkbox semantics'], ['columns', '1 | 2 at sm+'], ['size', 'md | lg']]}>
        <div className="grid gap-6 md:grid-cols-2">
          <ChoiceGroup
            label="Goal"
            size="lg"
            value={goal}
            onChange={setGoal}
            options={[
              { value: 'code', label: 'Write code faster', description: 'Editors, review, debugging' },
              { value: 'write', label: 'Write and edit', description: 'Docs, email, content' },
              { value: 'automate', label: 'Automate busywork', description: 'Reports, data entry' },
            ]}
          />
          <ChoiceGroup
            label="Constraints"
            multiple
            value={constraints}
            onChange={setConstraints}
            options={[
              { value: 'privacy', label: 'No training on my data' },
              { value: 'budget', label: 'Under $30/month' },
              { value: 'offline', label: 'Works offline' },
              { value: 'eu', label: 'EU data residency' },
            ]}
          />
        </div>
      </Doc>
      <Doc name="TextInput · TextArea · Select" usage="Label above, hint below. Errors replace the hint and say what to do.">
        <div className="grid gap-4 md:grid-cols-2">
          <TextInput label="Workload name" placeholder="e.g. Customer support triage" />
          <TextInput label="Monthly volume" defaultValue="12,4OO" error="Use digits only — the letter O was entered instead of zero." />
          <Select
            label="Data sensitivity"
            options={[
              { value: 'pii', label: 'Contains customer PII' },
              { value: 'internal', label: 'Internal only' },
              { value: 'public', label: 'Public' },
            ]}
          />
          <TextArea label="What does success look like?" hint="One or two sentences. We use this to pick evaluation metrics." rows={3} />
        </div>
      </Doc>
      <Doc name="Toggle · Slider" usage="Toggles for settings that apply immediately. Sliders for ROI and cost assumptions — values update the model live.">
        <div className="grid gap-6 md:grid-cols-2">
          <Toggle checked={on} onChange={setOn} label="Email me when a recommended tool changes price" description="At most once a week." />
          <Slider label="Tickets per month" value={vol} min={1000} max={50000} step={100} onChange={setVol} format={(v) => v.toLocaleString()} />
        </div>
      </Doc>
      <Doc name="ProgressBar · ScoreRing" usage="ProgressBar for setup and assessment progress. ScoreRing for fit and readiness scores — neutral fill unless the score is measured.">
        <div className="flex flex-wrap items-center gap-8">
          <div className="w-64">
            <ProgressBar value={60} label="Setup progress" />
            <p className="mt-2 text-body-sm text-fg-muted">3 of 5 setup steps complete</p>
          </div>
          <ScoreRing value={84} label="Suitability" />
          <ScoreRing value={72} label="Readiness" tone="accent" />
        </div>
      </Doc>
      <Doc name="Tabs" usage="Underline tabs for page sections; segmented for switching a view of the same data.">
        <div className="flex flex-col gap-6">
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'overview', label: 'Overview' },
              { value: 'risks', label: 'Risks', count: 7 },
              { value: 'costs', label: 'Costs' },
            ]}
          />
          <Tabs
            variant="segmented"
            value={seg}
            onChange={setSeg}
            tabs={[
              { value: 'table', label: 'Table' },
              { value: 'matrix', label: 'Matrix' },
            ]}
          />
        </div>
      </Doc>
    </div>
  )
}
