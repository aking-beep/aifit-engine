import React, { useState } from 'react'
import { Button, PageHeader, Select, Tabs, TextInput, Toggle, useTheme, useToast } from '../ds'
import { SAMPLE_ORG } from '../ds/sample/teams'

export function TeamsSettings() {
  const toast = useToast()
  const { theme, setTheme } = useTheme()
  const [tab, setTab] = useState('org')
  const [sso, setSso] = useState(true)
  const [stale, setStale] = useState(true)
  const [retention, setRetention] = useState(false)
  return (
    <div className="max-w-2xl">
      <PageHeader title="Settings" />
      <Tabs
        className="mb-8"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'org', label: 'Organization' },
          { value: 'security', label: 'Security' },
          { value: 'account', label: 'Your account' },
        ]}
      />
      {tab === 'org' && (
        <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); toast({ title: 'Organization updated', tone: 'success' }) }}>
          <TextInput label="Organization name" defaultValue={SAMPLE_ORG.name} />
          <Select label="Default data residency" options={[{ value: 'eu', label: 'European Union' }, { value: 'us', label: 'United States' }]} hint="Applied to every new workload intake." />
          <div className="divide-y divide-line">
            <Toggle checked={stale} onChange={setStale} label="Flag stale assessments" description="Mark results stale when model prices, vendor terms or policies change." />
          </div>
          <div><Button variant="primary" type="submit">Save</Button></div>
        </form>
      )}
      {tab === 'security' && (
        <div className="divide-y divide-line">
          <Toggle checked={sso} onChange={setSso} label="Require SSO" description="Members must sign in through your identity provider." />
          <Toggle checked={retention} onChange={setRetention} label="Delete intake answers after 12 months" description="Verdicts and blueprints are kept; raw answers are removed." />
        </div>
      )}
      {tab === 'account' && (
        <div className="flex flex-col gap-5">
          <TextInput label="Name" defaultValue="Jordan Reyes" />
          <TextInput label="Email" defaultValue="jordan@northwind.example" />
          <div>
            <p className="mb-2 text-label-md text-fg">Theme</p>
            <Tabs variant="segmented" value={theme} onChange={(v) => setTheme(v as 'light' | 'dark')} tabs={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }]} />
          </div>
        </div>
      )}
    </div>
  )
}
