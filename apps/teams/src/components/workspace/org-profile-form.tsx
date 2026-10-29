'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, ChoiceGroup, Select, TextInput, useToast } from '@/design';
import { api, ErrorText } from './ui';

export interface ProfileValue {
  industry: string;
  size: '' | '1-50' | '51-250' | '251-1000' | '1001-5000' | '5000+';
  regions: ('us' | 'eu' | 'uk' | 'apac' | 'other')[];
  dataResidency: 'any' | 'us' | 'eu' | 'on_prem';
  dataClasses: string[];
  regulated: string[];
  engineers: number | null;
}

export const EMPTY_PROFILE: ProfileValue = { industry: '', size: '', regions: [], dataResidency: 'any', dataClasses: [], regulated: [], engineers: null };

const DATA = [
  { value: 'pii', label: 'Personal data (names, emails, addresses)' },
  { value: 'sensitive_pii', label: 'Government IDs or biometrics' },
  { value: 'phi', label: 'Health information' },
  { value: 'pci', label: 'Card payment data' },
  { value: 'financial', label: 'Financial records' },
  { value: 'credentials', label: 'Credentials and keys' },
  { value: 'trade_secret', label: 'Trade secrets and contracts' },
  { value: 'minors', label: 'Data about children' },
];
const REGS = [
  { value: 'gdpr', label: 'GDPR' }, { value: 'ccpa', label: 'CCPA' }, { value: 'hipaa', label: 'HIPAA' }, { value: 'pci', label: 'PCI DSS' },
  { value: 'sox', label: 'SOX' }, { value: 'glba', label: 'GLBA' }, { value: 'ferpa', label: 'FERPA' }, { value: 'eu_ai_act', label: 'EU AI Act' },
];

/**
 * The workspace profile: defaults for every new intake, nothing more. AI Fit
 * never asserts compliance; these answers generate "verify" requirements.
 */
export function OrgProfileForm({ name, initial, canEdit, step, onDoneHref }: { name: string; initial: ProfileValue; canEdit: boolean; step?: 0 | 1 | 2; onDoneHref?: string }) {
  const router = useRouter();
  const toast = useToast();
  const [orgName, setOrgName] = useState(name);
  const [p, setP] = useState<ProfileValue>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wizard = step !== undefined;
  const [at, setAt] = useState<0 | 1 | 2>(step ?? 0);

  async function save() {
    setBusy(true);
    setError(null);
    const res = await api('/api/workspace/settings', { body: { name: orgName, profile: p } });
    setBusy(false);
    if (!res.ok) return setError(res.data.error ?? 'Could not save.');
    toast({ title: 'Workspace profile saved', tone: 'success' });
    if (onDoneHref) router.push(onDoneHref);
    router.refresh();
  }

  const show = (n: 0 | 1 | 2) => !wizard || at === n;
  return (
    <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); if (wizard && at < 2) setAt((at + 1) as 1 | 2); else void save(); }}>
      {show(0) ? (
        <fieldset disabled={!canEdit} className="space-y-4">
          <legend className="text-title-md text-fg">Organization</legend>
          <TextInput label="Workspace name" value={orgName} maxLength={100} required onChange={(e) => setOrgName(e.target.value)} />
          <TextInput label="Industry" value={p.industry} maxLength={80} placeholder="e.g. Logistics" onChange={(e) => setP({ ...p, industry: e.target.value })} />
          <Select label="Company size" value={p.size} onChange={(e) => setP({ ...p, size: e.target.value as ProfileValue['size'] })} options={[{ value: '', label: 'Not given' }, ...['1-50', '51-250', '251-1000', '1001-5000', '5000+'].map((s) => ({ value: s, label: `${s} employees` }))]} />
        </fieldset>
      ) : null}
      {show(1) ? (
        <fieldset disabled={!canEdit} className="space-y-4">
          <legend className="text-title-md text-fg">Data and compliance</legend>
          <ChoiceGroup label="Data your workloads usually touch" multiple columns={2} options={DATA} value={p.dataClasses} onChange={(v) => setP({ ...p, dataClasses: v })} />
          <ChoiceGroup label="Regimes that apply to you" multiple columns={2} options={REGS} value={p.regulated} onChange={(v) => setP({ ...p, regulated: v })} />
          <Select label="Where data must stay" value={p.dataResidency} onChange={(e) => setP({ ...p, dataResidency: e.target.value as ProfileValue['dataResidency'] })} options={[{ value: 'any', label: 'Anywhere' }, { value: 'us', label: 'United States' }, { value: 'eu', label: 'European Union' }, { value: 'on_prem', label: 'Our own infrastructure' }]} />
          <p className="text-body-sm text-fg-muted">We never assert compliance. These answers become requirements for you to verify.</p>
        </fieldset>
      ) : null}
      {show(2) ? (
        <fieldset disabled={!canEdit} className="space-y-4">
          <legend className="text-title-md text-fg">Team</legend>
          <TextInput label="Engineers who could build and run this" type="number" min={0} max={100000} value={p.engineers ?? ''} onChange={(e) => setP({ ...p, engineers: e.target.value === '' ? null : Math.max(0, Math.floor(Number(e.target.value))) })} />
          <p className="text-body-sm text-fg-muted">Invite colleagues from Members after setup.</p>
        </fieldset>
      ) : null}
      <ErrorText message={error} />
      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          {wizard && at > 0 ? <Button type="button" onClick={() => setAt((at - 1) as 0 | 1)}>Back</Button> : null}
          <Button type="submit" variant="primary" loading={busy}>{wizard && at < 2 ? 'Next' : wizard ? 'Finish setup' : 'Save'}</Button>
          {wizard ? <Button type="button" variant="ghost" onClick={() => onDoneHref && router.push(onDoneHref)}>Skip for now</Button> : null}
        </div>
      ) : <p className="text-body-sm text-fg-muted">Only admins and owners can change workspace settings.</p>}
    </form>
  );
}
