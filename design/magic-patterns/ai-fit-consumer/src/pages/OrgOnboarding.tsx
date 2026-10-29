import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { Button, ChoiceGroup, Logo, Select, TextInput, ThemeToggle, cn } from '../ds'

const STEPS = ['Organization', 'Data & compliance', 'Team']

export function OrgOnboarding() {
  const nav = useNavigate()
  const [step, setStep] = useState(0)
  const [data, setData] = useState<string[]>(['pii', 'contracts'])
  const [regions, setRegions] = useState<string[]>(['us', 'eu'])
  const [invites, setInvites] = useState('priya@northwind.example, tom@northwind.example')

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-canvas md:flex-row">
      <aside className="border-b border-line bg-surface p-6 md:w-72 md:shrink-0 md:border-r md:border-b-0 md:p-8">
        <div className="flex items-center justify-between">
          <Logo product="Teams" />
          <ThemeToggle />
        </div>
        <h1 className="mt-10 hidden text-headline-md text-fg md:block">Set up your organization</h1>
        <p className="mt-1 hidden text-body-sm text-fg-muted md:block">About 3 minutes. Used to filter vendors, models and controls for every workload.</p>
        <ol className="mt-6 flex gap-4 md:mt-10 md:flex-col md:gap-3">
          {STEPS.map((s, i) => (
            <li key={s} className="flex items-center gap-3">
              <span className={cn('flex h-6 w-6 items-center justify-center rounded-full border font-mono text-[11px]', i < step ? 'border-fg bg-fg text-canvas' : i === step ? 'border-accent text-accent' : 'border-line-strong text-fg-muted')}>
                {i < step ? <Check size={12} strokeWidth={2.5} /> : i + 1}
              </span>
              <span className={cn('hidden text-label-md sm:inline', i === step ? 'text-fg' : 'text-fg-muted')}>{s}</span>
            </li>
          ))}
        </ol>
      </aside>
      <main className="flex flex-1 flex-col px-4 py-10 md:px-12 md:py-16">
        <div className="w-full max-w-xl">
          {step === 0 && (
            <div className="flex flex-col gap-5">
              <h2 className="text-headline-lg text-fg">Tell us about your organization</h2>
              <TextInput label="Organization name" defaultValue="Northwind Logistics" />
              <div className="grid gap-4 sm:grid-cols-2">
                <Select label="Industry" options={[{ value: 'log', label: 'Logistics & freight' }, { value: 'fin', label: 'Financial services' }, { value: 'health', label: 'Healthcare' }, { value: 'retail', label: 'Retail' }]} />
                <Select label="Company size" options={[{ value: '1k', label: '1,000–5,000' }, { value: '200', label: '200–1,000' }, { value: '50', label: '50–200' }, { value: '5k', label: '5,000+' }]} />
              </div>
              <Select label="Primary cloud" options={[{ value: 'aws', label: 'AWS' }, { value: 'azure', label: 'Azure' }, { value: 'gcp', label: 'Google Cloud' }, { value: 'none', label: 'None / mixed' }]} hint="We prefer services you already have approved." />
            </div>
          )}
          {step === 1 && (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="text-headline-lg text-fg">Data and compliance</h2>
                <p className="mt-1 text-body-sm text-fg-muted">We never assert compliance. These answers generate “verify with vendor” requirements.</p>
              </div>
              <div>
                <p className="mb-2 text-label-md text-fg">Data your workloads handle</p>
                <ChoiceGroup label="Data classes" multiple columns={2} value={data} onChange={setData} options={[{ value: 'pii', label: 'Customer PII' }, { value: 'phi', label: 'Health data (PHI)' }, { value: 'pci', label: 'Payment card data' }, { value: 'contracts', label: 'Contracts & legal' }, { value: 'employee', label: 'Employee records' }, { value: 'public', label: 'Public only' }]} />
              </div>
              <div>
                <p className="mb-2 text-label-md text-fg">Data residency</p>
                <ChoiceGroup label="Regions" multiple columns={2} value={regions} onChange={setRegions} options={[{ value: 'us', label: 'United States' }, { value: 'eu', label: 'European Union' }, { value: 'uk', label: 'United Kingdom' }, { value: 'apac', label: 'Asia-Pacific' }]} />
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="flex flex-col gap-5">
              <h2 className="text-headline-lg text-fg">Invite your team</h2>
              <p className="-mt-3 text-body-sm text-fg-muted">Analysts run assessments; viewers read reports. You can change roles later.</p>
              <TextInput label="Email addresses" value={invites} onChange={(e) => setInvites(e.target.value)} hint="Comma-separated. Invitations are sent when you finish." />
              <Select label="Default role" options={[{ value: 'analyst', label: 'Analyst' }, { value: 'viewer', label: 'Viewer' }, { value: 'admin', label: 'Admin' }]} />
            </div>
          )}
          <div className="mt-12 flex items-center justify-between">
            <Button variant="ghost" icon={<ArrowLeft size={14} />} onClick={() => (step === 0 ? nav('/') : setStep(step - 1))}>
              Back
            </Button>
            <div className="flex gap-2">
              {step === 2 && (
                <Button variant="ghost" onClick={() => nav('/app/intake')}>
                  Skip
                </Button>
              )}
              <Button variant="primary" iconRight={<ArrowRight size={14} />} onClick={() => (step < 2 ? setStep(step + 1) : nav('/app/intake'))}>
                {step < 2 ? 'Continue' : 'Create workspace'}
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
