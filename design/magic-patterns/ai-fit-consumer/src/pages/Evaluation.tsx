import React, { useState } from 'react'
import { Banner, Button, EvalResults, ErrorState, Skeleton } from '../ds'
import { EVAL_CHECKS } from '../ds/sample/teams'
import { WorkloadHeader } from '../layout/WorkloadHeader'

type RunState = 'idle' | 'running' | 'error'

/** Evaluation planning + results. Demonstrates loading and error states for a run. */
export function Evaluation() {
  const [state, setState] = useState<RunState>('idle')
  const run = (fail: boolean) => {
    setState('running')
    setTimeout(() => setState(fail ? 'error' : 'idle'), 1200)
  }
  return (
    <div>
      <WorkloadHeader
        stage="validate"
        title="Evaluation plan"
        description="Go-live criteria for this workload. Results are recorded only from runs against your labelled tickets."
        actions={
          <>
            <Button onClick={() => run(true)}>Simulate failed run</Button>
            <Button variant="primary" loading={state === 'running'} onClick={() => run(false)}>
              Run pending checks
            </Button>
          </>
        }
      />
      <div className="mb-6">
        <Banner tone="danger" title="Go-live blocked: grounding below threshold" action={<Button size="sm">View failing examples</Button>}>
          95.3% of draft claims were supported against a 97% target. 94 of 2,000 drafts cited order data that didn’t match.
        </Banner>
      </div>
      {state === 'error' && (
        <div className="mb-6">
          <ErrorState title="Evaluation run didn’t complete" cause="The labelled-tickets dataset couldn’t be read — the export link expired after 7 days." fix="Re-export the dataset from Zendesk, or ask an admin to extend link expiry." onRetry={() => run(false)} code="EVAL-0193" />
        </div>
      )}
      {state === 'running' ? (
        <div className="flex flex-col gap-2 rounded-md border border-line bg-surface p-4">
          {EVAL_CHECKS.map((c) => (
            <div key={c.id} className="flex items-center gap-3 py-1.5">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="ml-auto h-4 w-20" />
            </div>
          ))}
        </div>
      ) : (
        <EvalResults checks={EVAL_CHECKS} />
      )}
      <section className="mt-8 grid gap-8 md:grid-cols-2">
        <div>
          <h2 className="mb-2 text-title-md text-fg">Dataset</h2>
          <p className="text-body-sm text-fg-2">2,000 labelled tickets, stratified by intent; 10% held out. PII redacted before evaluation.</p>
        </div>
        <div>
          <h2 className="mb-2 text-title-md text-fg">Cadence</h2>
          <p className="text-body-sm text-fg-2">Full suite on every model or prompt change; weekly 5% production sample during rollout.</p>
        </div>
      </section>
    </div>
  )
}
