import React, { useState } from 'react'
import { Banner, Button, DownloadPreview, EvidenceLabel, Modal, downloadFiles, useToast } from '../ds'
import { BLUEPRINT_FILES } from '../ds/sample/teams'
import { WorkloadHeader } from '../layout/WorkloadHeader'

/** Technical blueprint preview + download. Gated by entitlement (Blueprint or Workspace plan). */
export function Blueprint() {
  const toast = useToast()
  const [entitled, setEntitled] = useState(true)
  const [confirm, setConfirm] = useState(false)
  const name = 'northwind-support-triage-blueprint-v3'
  return (
    <div>
      <WorkloadHeader
        stage="configure"
        title="Technical blueprint"
        description="Everything decided so far, in formats your engineering and governance teams can use directly."
        actions={
          <label className="flex items-center gap-2 text-label-md text-fg-muted">
            <input type="checkbox" checked={!entitled} onChange={(e) => setEntitled(!e.target.checked)} className="accent-[var(--color-accent)]" />
            Preview without entitlement
          </label>
        }
      />
      {!entitled && (
        <div className="mb-6">
          <Banner title="Blueprint download requires the Blueprint or Workspace plan" action={<Button size="sm" variant="primary">See plans</Button>}>
            You can preview the structure below. Download unlocks after purchase.
          </Banner>
        </div>
      )}
      <div className="grid gap-6 xl:grid-cols-[1fr_280px]">
        <div className={entitled ? '' : 'pointer-events-none opacity-60 select-none'}>
          <DownloadPreview
            name={name}
            files={BLUEPRINT_FILES}
            meta="4 files · generated 14 Jun 2025 · sample"
            onDownload={() => setConfirm(true)}
          />
        </div>
        <aside className="h-fit">
          <h2 className="mb-3 text-title-md text-fg">Contents</h2>
          <ul className="flex flex-col gap-2 text-body-sm">
            {[
              ['Verdict & reasoning', 'recommendation'],
              ['Architecture & data flow', 'recommendation'],
              ['Model selection', 'verified'],
              ['Cost model', 'estimated'],
              ['Risk register (7)', 'estimated'],
              ['Evaluation plan', 'verified'],
              ['Governance export', 'recommendation'],
              ['Prompt injection results', 'untested'],
            ].map(([l, e]) => (
              <li key={l} className="flex items-center justify-between gap-3 border-b border-line pb-2">
                <span className="text-fg-2">{l}</span>
                <EvidenceLabel kind={e as 'verified'} compact />
              </li>
            ))}
          </ul>
        </aside>
      </div>
      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Download blueprint"
        description="This blueprint contains 1 blocking evaluation failure and 2 untested checks. They are clearly marked inside."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => {
                downloadFiles(name, BLUEPRINT_FILES)
                setConfirm(false)
                toast({ title: 'Blueprint downloaded', body: 'Recorded in assessment history as v3.', tone: 'success' })
              }}
            >
              Download anyway
            </Button>
          </>
        }
      />
    </div>
  )
}
