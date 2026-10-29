import React, { useState } from 'react'
import { ClipboardList } from 'lucide-react'
import { Banner, Button, Drawer, EmptyState, EngineProgress, ErrorState, Modal, PageHeader, Skeleton, useToast } from '../ds'
import { Doc } from './Doc'

export function FeedbackDocs() {
  const [modal, setModal] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const [run, setRun] = useState(0)
  const toast = useToast()
  return (
    <div>
      <PageHeader title="Feedback & overlays" description="States are designed, not defaulted. Empty states name the next step; errors give cause, fix and retry." />
      <Doc name="EmptyState" usage="Always ends with the action that fills it.">
        <EmptyState icon={<ClipboardList size={22} strokeWidth={1.5} />} title="No assessments yet" description="Run a five-minute assessment to get your AI profile and tool recommendations." action={<Button variant="primary">Start assessment</Button>} />
      </Doc>
      <Doc name="ErrorState" usage="Cause, fix, retry and a reference code. Never “Something went wrong”.">
        <ErrorState title="Couldn’t generate the configuration" cause="The Cursor settings template references a field that changed in the latest release." fix="Retry to use the updated template, or download the previous version." onRetry={() => toast({ title: 'Retrying…', tone: 'info' })} code="CFG-2041" />
      </Doc>
      <Doc name="Banner" usage="Inline status at the top of a region. Info, warning, danger, success.">
        <div className="flex flex-col gap-3">
          <Banner title="Pricing changed for Zapier" tone="warn" action={<Button size="sm">Re-assess</Button>}>
            Your recommendation is from 2025-05-28. One input may be out of date.
          </Banner>
          <Banner title="Evaluation passed" tone="success">
            All go-live checks met their thresholds.
          </Banner>
        </div>
      </Doc>
      <Doc name="Skeleton · EngineProgress" usage="Skeletons match the final layout for loads under 2s. EngineProgress shows real steps for longer engine runs.">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-3 rounded-md border border-line bg-surface p-4">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="mt-2 h-9 w-full" />
          </div>
          <div>
            <EngineProgress key={run} steps={['Reading your answers', 'Scoring 140 tools against constraints', 'Checking privacy terms', 'Ranking and explaining']} />
            <Button size="sm" className="mt-4" onClick={() => setRun((r) => r + 1)}>
              Replay
            </Button>
          </div>
        </div>
      </Doc>
      <Doc name="Modal · Drawer · Toast" usage="Modal for decisions that block (240ms, from scale 0.96). Drawer for detail and reasoning. Toasts confirm background actions and dismiss after 4s.">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setModal(true)}>Open modal</Button>
          <Button onClick={() => setDrawer(true)}>Open drawer</Button>
          <Button onClick={() => toast({ title: 'Saved to recommendations', body: 'Find it under Saved.', tone: 'success' })}>Show toast</Button>
        </div>
        <Modal
          open={modal}
          onClose={() => setModal(false)}
          title="Accept the No-AI verdict?"
          description="We’ll mark this workload as resolved with your accounting app’s built-in reminders."
          footer={
            <>
              <Button variant="ghost" onClick={() => setModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => setModal(false)}>
                Accept verdict
              </Button>
            </>
          }
        />
        <Drawer open={drawer} onClose={() => setDrawer(false)} title="Why this verdict">
          <p className="text-body-sm text-fg-2">Detail panels hold reasoning, evidence and alternatives so the main view can lead with the answer.</p>
        </Drawer>
      </Doc>
    </div>
  )
}
