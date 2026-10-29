import React, { useState } from 'react'
import { UserPlus } from 'lucide-react'
import { Button, Modal, PageHeader, Select, TextInput, useToast } from '../ds'
import type { Member } from '../ds'
import { MEMBERS } from '../ds/sample/teams'

const ROLE_HELP: Record<Member['role'], string> = {
  owner: 'Billing, members, all workloads',
  admin: 'Members and all workloads',
  analyst: 'Create and edit assessments',
  viewer: 'Read reports and blueprints',
}

export function Admin() {
  const toast = useToast()
  const [members, setMembers] = useState(MEMBERS)
  const [invite, setInvite] = useState(false)
  const [email, setEmail] = useState('')
  const [err, setErr] = useState('')
  const send = () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setErr('Enter a full email address, like name@company.com.')
    setMembers([...members, { id: email, name: '', email, role: 'analyst', lastActive: '—', status: 'invited' }])
    setInvite(false)
    setEmail('')
    toast({ title: 'Invitation sent', body: email, tone: 'success' })
  }
  return (
    <div>
      <PageHeader
        title="Team administration"
        description={`${members.filter((m) => m.status === 'active').length} active · ${members.filter((m) => m.status === 'invited').length} invited · 25 seats on Workspace`}
        actions={
          <Button variant="primary" icon={<UserPlus size={14} />} onClick={() => setInvite(true)}>
            Invite member
          </Button>
        }
      />
      <div className="overflow-x-auto rounded-md border border-line bg-surface">
        <table className="w-full min-w-[640px] text-body-sm">
          <thead className="bg-sunken text-left text-label-sm text-fg-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Member</th>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2 font-medium">Last active</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-t border-line">
                <td className="px-4 py-2.5">
                  <span className="text-fg">{m.name || m.email}</span>
                  {m.status === 'invited' && <span className="ml-2 text-label-sm text-fg-muted">Invited</span>}
                  {m.name && <span className="block text-label-sm text-fg-muted">{m.email}</span>}
                </td>
                <td className="px-4 py-2.5">
                  {m.role === 'owner' ? (
                    <span className="text-fg-2">Owner</span>
                  ) : (
                    <select
                      aria-label={`Role for ${m.email}`}
                      value={m.role}
                      onChange={(e) => setMembers(members.map((x) => (x.id === m.id ? { ...x, role: e.target.value as Member['role'] } : x)))}
                      className="h-7 rounded-xs border border-line bg-surface px-2 text-body-sm text-fg"
                    >
                      <option value="admin">Admin</option>
                      <option value="analyst">Analyst</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  )}
                  <span className="block text-label-sm text-fg-muted">{ROLE_HELP[m.role]}</span>
                </td>
                <td className="px-4 py-2.5 text-fg-muted">{m.lastActive}</td>
                <td className="px-4 py-2.5 text-right">
                  {m.role !== 'owner' && (
                    <Button size="sm" variant="ghost" onClick={() => setMembers(members.filter((x) => x.id !== m.id))}>
                      {m.status === 'invited' ? 'Revoke' : 'Remove'}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 className="mt-10 mb-3 text-headline-md text-fg">Audit log</h2>
      <ul className="flex flex-col text-body-sm">
        {['Priya N. changed Tom A. to Analyst · 2 days ago', 'Jordan R. exported blueprint v3 · 3 days ago', 'Jordan R. enabled SSO enforcement · 1 week ago'].map((l) => (
          <li key={l} className="border-b border-line py-2.5 text-fg-2 last:border-0">
            {l}
          </li>
        ))}
      </ul>
      <Modal
        open={invite}
        onClose={() => setInvite(false)}
        title="Invite a team member"
        footer={
          <>
            <Button variant="ghost" onClick={() => setInvite(false)}>Cancel</Button>
            <Button variant="primary" onClick={send}>Send invitation</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <TextInput label="Email" value={email} error={err} onChange={(e) => { setEmail(e.target.value); setErr('') }} placeholder="name@northwind.example" />
          <Select label="Role" options={[{ value: 'analyst', label: 'Analyst' }, { value: 'viewer', label: 'Viewer' }, { value: 'admin', label: 'Admin' }]} />
        </div>
      </Modal>
    </div>
  )
}
