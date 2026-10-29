import React, { useState } from 'react'
import { Button, Modal, PageHeader, Tabs, TextInput, Toggle, useTheme, useToast } from '../ds'
import { SAMPLE_USER } from '../ds/sample/consumer'

export function Settings() {
  const toast = useToast()
  const { theme, setTheme } = useTheme()
  const [tab, setTab] = useState('profile')
  const [alerts, setAlerts] = useState(true)
  const [digest, setDigest] = useState(false)
  const [improve, setImprove] = useState(false)
  const [del, setDel] = useState(false)
  return (
    <div className="max-w-2xl">
      <PageHeader title="Account settings" />
      <Tabs
        className="mb-8"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'profile', label: 'Profile' },
          { value: 'notifications', label: 'Notifications' },
          { value: 'privacy', label: 'Privacy & data' },
        ]}
      />
      {tab === 'profile' && (
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault()
            toast({ title: 'Profile saved', tone: 'success' })
          }}
        >
          <TextInput label="Name" defaultValue={SAMPLE_USER.name} />
          <TextInput label="Email" type="email" defaultValue={SAMPLE_USER.email} hint="We’ll send a confirmation link if you change this." />
          <TextInput label="What you do" defaultValue={SAMPLE_USER.role} />
          <div>
            <p className="mb-2 text-label-md text-fg">Theme</p>
            <Tabs
              variant="segmented"
              value={theme}
              onChange={(v) => setTheme(v as 'light' | 'dark')}
              tabs={[
                { value: 'dark', label: 'Dark' },
                { value: 'light', label: 'Light' },
              ]}
            />
          </div>
          <div>
            <Button variant="primary" type="submit">
              Save changes
            </Button>
          </div>
        </form>
      )}
      {tab === 'notifications' && (
        <div className="divide-y divide-line">
          <Toggle checked={alerts} onChange={setAlerts} label="Change alerts" description="When a saved tool changes price, privacy terms or availability." />
          <Toggle checked={digest} onChange={setDigest} label="Monthly digest" description="New tools that match your profile. At most once a month." />
        </div>
      )}
      {tab === 'privacy' && (
        <div>
          <div className="divide-y divide-line">
            <Toggle checked={improve} onChange={setImprove} label="Help improve recommendations" description="Share anonymised assessment answers. Off by default." />
          </div>
          <div className="mt-8 flex flex-wrap gap-2">
            <Button onClick={() => toast({ title: 'Export prepared', body: 'Prototype — a JSON export would download here.', tone: 'info' })}>Export my data</Button>
            <Button variant="danger" onClick={() => setDel(true)}>
              Delete account
            </Button>
          </div>
        </div>
      )}
      <Modal
        open={del}
        onClose={() => setDel(false)}
        title="Delete your account?"
        description="This permanently removes your profile, assessments and generated packages. This can’t be undone."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDel(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => setDel(false)}>
              Delete permanently
            </Button>
          </>
        }
      />
    </div>
  )
}
