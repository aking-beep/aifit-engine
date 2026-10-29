import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, ChoiceGroup, EngineProgress, PageHeader, Select, Slider, StageRail, TextArea, TextInput, cn } from '../ds'

const SECTIONS = [
  { id: 'objective', label: 'Objective' },
  { id: 'process', label: 'Process' },
  { id: 'data', label: 'Data' },
  { id: 'constraints', label: 'Constraints' },
  { id: 'success', label: 'Success criteria' },
]

/** Business workload intake — the Understand stage for Teams. */
export function Intake() {
  const nav = useNavigate()
  const [sec, setSec] = useState(0)
  const [running, setRunning] = useState(false)
  const [volume, setVolume] = useState(12400)
  const [repeat, setRepeat] = useState(62)
  const [tolerance, setTolerance] = useState<string[]>(['review'])
  const [data, setData] = useState<string[]>(['pii'])
  const [constraints, setConstraints] = useState<string[]>(['eu', 'existing'])
  const [name, setName] = useState('Customer support triage')
  const [nameErr, setNameErr] = useState('')

  if (running) {
    return (
      <div className="mx-auto max-w-lg py-16">
        <h1 className="text-headline-lg text-fg">Assessing “{name}”</h1>
        <p className="mt-1 mb-8 text-body-sm text-fg-muted">Seven-dimension suitability rubric, then build-vs-buy, then risks.</p>
        <EngineProgress stepMs={500} steps={['Scoring volume, repetition and error tolerance', 'Checking whether rules or existing software suffice', 'Matching vendors against EU residency', 'Estimating run costs from dated model prices', 'Drafting risk register and verdict']} onDone={() => nav('/app/verdict')} />
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="New workload intake" description="Describe the business process. The more specific you are, the more defensible the verdict." />
      <StageRail current="understand" />
      <div className="mt-8 grid gap-8 lg:grid-cols-[200px_1fr_280px]">
        <nav aria-label="Intake sections" className="lg:sticky lg:top-0 lg:h-fit">
          <ol className="flex gap-1 overflow-x-auto lg:flex-col">
            {SECTIONS.map((s, i) => (
              <li key={s.id}>
                <button onClick={() => setSec(i)} className={cn('flex h-8 w-full items-center gap-2 whitespace-nowrap rounded-sm px-2 text-label-md transition-colors duration-150', i === sec ? 'bg-sunken text-fg' : 'text-fg-muted hover:text-fg')}>
                  <span className="font-mono text-label-sm">{i + 1}</span>
                  {s.label}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <div className="flex max-w-2xl flex-col gap-5">
          {sec === 0 && (
            <>
              <TextInput label="Workload name" value={name} error={nameErr} onChange={(e) => { setName(e.target.value); setNameErr(e.target.value.trim() ? '' : 'Give the workload a name so your team can find it.') }} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Select label="Department" options={[{ value: 'support', label: 'Customer support' }, { value: 'finance', label: 'Finance' }, { value: 'ops', label: 'Operations' }, { value: 'legal', label: 'Legal' }]} />
                <Select label="Business owner" options={[{ value: 'priya', label: 'Priya Natarajan' }, { value: 'tom', label: 'Tom Alvarez' }]} />
              </div>
              <TextArea label="What problem are you solving?" defaultValue="Agents spend ~40% of their time routing and answering repetitive shipment-status tickets. First response time is 9 hours against a 4-hour target." />
            </>
          )}
          {sec === 1 && (
            <>
              <Slider label="Volume per month" value={volume} min={100} max={60000} step={100} onChange={setVolume} format={(v) => v.toLocaleString()} />
              <Slider label="Share that is repetitive" value={repeat} min={0} max={100} onChange={setRepeat} format={(v) => `${v}%`} />
              <div>
                <p className="mb-2 text-label-md text-fg">What happens if the output is wrong?</p>
                <ChoiceGroup
                  label="Error tolerance"
                  value={tolerance}
                  onChange={setTolerance}
                  options={[
                    { value: 'none', label: 'Unacceptable', description: 'Regulatory, financial or safety impact' },
                    { value: 'review', label: 'Caught by a human', description: 'An agent reviews before it reaches a customer' },
                    { value: 'low', label: 'Minor inconvenience', description: 'Easy to correct after the fact' },
                  ]}
                />
              </div>
            </>
          )}
          {sec === 2 && (
            <>
              <div>
                <p className="mb-2 text-label-md text-fg">Data involved</p>
                <ChoiceGroup label="Data" multiple columns={2} value={data} onChange={setData} options={[{ value: 'pii', label: 'Customer PII' }, { value: 'financial', label: 'Financial records' }, { value: 'contracts', label: 'Contracts' }, { value: 'internal', label: 'Internal docs only' }]} />
              </div>
              <Select label="Labelled historical examples" options={[{ value: '18m', label: 'Yes — 18 months tagged' }, { value: 'some', label: 'Some, untagged' }, { value: 'none', label: 'None' }]} hint="Needed to evaluate any AI option before go-live." />
            </>
          )}
          {sec === 3 && (
            <div>
              <p className="mb-2 text-label-md text-fg">Constraints</p>
              <ChoiceGroup label="Constraints" multiple columns={2} value={constraints} onChange={setConstraints} options={[{ value: 'eu', label: 'EU data residency' }, { value: 'existing', label: 'Must integrate with Zendesk' }, { value: 'onprem', label: 'On-premise only' }, { value: 'budget', label: 'Under $5k/month' }, { value: 'explain', label: 'Decisions must be explainable' }, { value: 'fast', label: 'Live within 90 days' }]} />
            </div>
          )}
          {sec === 4 && (
            <>
              <TextArea label="What does success look like?" defaultValue="First response under 4 hours; agent time on routing cut by half; no increase in escalations." />
              <TextInput label="Primary metric" defaultValue="Median first response time" />
            </>
          )}
          <div className="flex justify-between gap-2 border-t border-line pt-5">
            <Button variant="ghost" disabled={sec === 0} onClick={() => setSec(sec - 1)}>
              Previous
            </Button>
            {sec < SECTIONS.length - 1 ? (
              <Button onClick={() => setSec(sec + 1)}>Next section</Button>
            ) : (
              <Button variant="primary" disabled={!name.trim()} onClick={() => setRunning(true)}>
                Run assessment
              </Button>
            )}
          </div>
        </div>

        <aside className="h-fit rounded-md border border-line bg-surface p-4 lg:sticky lg:top-0">
          <p className="text-label-sm text-fg-muted">Live read</p>
          <p className="mt-1 text-title-md text-fg">Early signal: AI likely suitable</p>
          <ul className="mt-3 flex flex-col gap-1.5 text-body-sm text-fg-2">
            <li className="flex justify-between">Volume <span className="font-mono text-fg">{volume.toLocaleString()}</span></li>
            <li className="flex justify-between">Repetitive <span className="font-mono text-fg">{repeat}%</span></li>
            <li className="flex justify-between">PII <span className="text-fg">{data.includes('pii') ? 'Yes' : 'No'}</span></li>
          </ul>
          <p className="mt-3 text-body-sm text-fg-muted">{repeat > 80 && tolerance.includes('none') ? 'Highly repetitive and zero-tolerance: rules-based automation may be better.' : 'Final verdict is computed when you run the assessment.'}</p>
        </aside>
      </div>
    </div>
  )
}
