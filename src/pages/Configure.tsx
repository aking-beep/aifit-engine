import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check } from 'lucide-react'
import { Banner, Button, ChoiceGroup, DownloadPreview, EngineProgress, EvidenceLabel, PageHeader, Select, StageRail, Toggle, downloadFiles, useToast } from '../ds'
import type { GeneratedFile } from '../ds'
import { SAMPLE_PACKAGE_FILES } from '../ds/sample/consumer'
import { useConsumer } from '../store'

type Phase = 'form' | 'generating' | 'preview' | 'downloaded'

/** Configuration generator → preview → downloadable setup package. */
export function Configure() {
  const nav = useNavigate()
  const toast = useToast()
  const { allTools, configTool, setConfigTool, planId } = useConsumer()
  const [phase, setPhase] = useState<Phase>('form')
  const [os, setOs] = useState('mac')
  const [privacy, setPrivacy] = useState(true)
  const [reviewRule, setReviewRule] = useState(true)
  const [include, setInclude] = useState<string[]>(['zapier'])
  const tool = allTools.find((t) => t.id === configTool) ?? allTools[0]

  const files = useMemo<GeneratedFile[]>(() => {
    let f = SAMPLE_PACKAGE_FILES
    if (!reviewRule) f = f.filter((x) => !x.path.includes('review'))
    if (!include.includes('zapier')) f = f.filter((x) => x.path !== 'weekly-report.json')
    return f.map((x) => (x.path === '.cursor/settings.json' ? { ...x, content: x.content.replace('"cursor.privacyMode": true', `"cursor.privacyMode": ${privacy}`) } : x))
  }, [privacy, reviewRule, include])

  return (
    <div>
      <PageHeader title="Configuration generator" description="Settings, rules and scripts generated for your profile. Review every file before you run anything." />
      <StageRail current={phase === 'downloaded' ? 'validate' : 'configure'} completed={phase === 'downloaded' ? ['understand', 'decide', 'configure'] : ['understand', 'decide']} />

      {phase === 'form' && (
        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_320px]">
          <div className="flex flex-col gap-8">
            <section>
              <h2 className="mb-3 text-title-md text-fg">Primary tool</h2>
              <ChoiceGroup
                label="Primary tool"
                columns={2}
                value={[tool.id]}
                onChange={(v) => setConfigTool(v[0])}
                options={allTools.slice(0, 4).map((t) => ({ value: t.id, label: t.name, description: t.category }))}
              />
            </section>
            <section className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Operating system"
                value={os}
                onChange={(e) => setOs(e.target.value)}
                options={[
                  { value: 'mac', label: 'macOS' },
                  { value: 'win', label: 'Windows' },
                  { value: 'linux', label: 'Linux' },
                ]}
              />
              <Select label="Preset" options={[{ value: 'builder', label: 'Builder-Creator (from your profile)' }, { value: 'minimal', label: 'Minimal' }]} />
            </section>
            <section>
              <h2 className="text-title-md text-fg">Options</h2>
              <div className="divide-y divide-line">
                <Toggle checked={privacy} onChange={setPrivacy} label="Turn on Privacy Mode" description="Required by your NDA constraint. Code isn’t retained or used for training." />
                <Toggle checked={reviewRule} onChange={setReviewRule} label="Add a code-review rule" description="Checks accessibility, tests and leaked secrets on request." />
              </div>
              {!privacy && (
                <div className="mt-3">
                  <Banner tone="warn" title="This conflicts with your constraints">
                    You told us you work with client code under NDA. Without Privacy Mode, inputs may be retained by the vendor.
                  </Banner>
                </div>
              )}
            </section>
            <section>
              <h2 className="mb-3 text-title-md text-fg">Include in package</h2>
              <ChoiceGroup
                label="Include"
                multiple
                value={include}
                onChange={setInclude}
                options={[
                  { value: 'zapier', label: 'Weekly report automation (Zapier)', description: 'From your “Weekly client report” workflow' },
                  { value: 'claude', label: 'Claude data-control checklist' },
                ]}
              />
            </section>
          </div>
          <aside className="h-fit rounded-md border border-line bg-surface p-5 lg:sticky lg:top-6">
            <p className="text-label-sm text-fg-muted">Package summary</p>
            <p className="mt-1 text-headline-md text-fg">{tool.name} setup</p>
            <ul className="mt-4 flex flex-col gap-2 text-body-sm text-fg-2">
              <li className="flex justify-between">Files <span className="font-mono text-fg">{files.length}</span></li>
              <li className="flex justify-between">Setup time <span className="font-mono text-fg">~{tool.setupMinutes + (include.includes('zapier') ? 25 : 0)} min</span></li>
              <li className="flex items-center justify-between">Privacy Mode <span className="text-fg">{privacy ? 'On' : 'Off'}</span></li>
            </ul>
            <EvidenceLabel kind="recommendation" className="mt-4" />
            <Button variant="primary" className="mt-5 w-full" onClick={() => setPhase('generating')}>
              Generate package
            </Button>
            {planId === 'consumer-free' && <p className="mt-3 text-label-sm text-fg-muted">Free plan: 1 of 1 package. Regenerating replaces it.</p>}
          </aside>
        </div>
      )}

      {phase === 'generating' && (
        <div className="mx-auto mt-12 max-w-md">
          <EngineProgress stepMs={400} steps={['Applying your profile preset', 'Writing settings for ' + tool.name, 'Adding privacy safeguards', 'Packaging files']} onDone={() => setPhase('preview')} />
        </div>
      )}

      {(phase === 'preview' || phase === 'downloaded') && (
        <div className="mt-8 flex flex-col gap-6">
          {phase === 'downloaded' && (
            <Banner tone="success" title="Package downloaded" action={<Button size="sm" onClick={() => nav('/app')}>Back to setup checklist</Button>}>
              Next: run <span className="font-mono">setup.sh</span>, then confirm Privacy Mode shows “On” in Cursor’s status bar. We’ll verify it with you in the Validate step.
            </Banner>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="ghost" icon={<ArrowLeft size={14} />} onClick={() => setPhase('form')}>
              Edit options
            </Button>
            <p className="text-body-sm text-fg-muted">Generated from sample templates · review before running scripts</p>
          </div>
          <DownloadPreview
            name={`${tool.id}-setup-package`}
            files={files}
            meta={`${files.length} files · ${os === 'mac' ? 'macOS' : os === 'win' ? 'Windows' : 'Linux'} · Builder-Creator preset`}
            onDownload={() => {
              downloadFiles(`${tool.id}-setup-package`, files)
              setPhase('downloaded')
              toast({ title: 'Setup package downloaded', tone: 'success' })
            }}
          />
          <section>
            <h2 className="mb-3 text-title-md text-fg">Validate after setup</h2>
            <ul className="overflow-hidden rounded-md border border-line bg-surface">
              {[
                { l: 'Privacy Mode shows On in status bar', e: 'untested' as const },
                { l: 'Review rule responds as a checklist', e: 'untested' as const },
                { l: 'Weekly Zap runs a test successfully', e: 'untested' as const },
              ].map((c) => (
                <li key={c.l} className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-0">
                  <span className="flex items-center gap-3 text-body-sm text-fg">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full border border-dashed border-line-strong">
                      <Check size={9} className="text-transparent" />
                    </span>
                    {c.l}
                  </span>
                  <EvidenceLabel kind={c.e} />
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  )
}
