import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Briefcase, Code2, GraduationCap, Palette, Rocket } from 'lucide-react'
import { Button, ChoiceGroup, Logo, ProgressBar, TextInput, ThemeToggle, cn } from '../ds'

const ROLES = [
  { id: 'developer', label: 'Developer', icon: <Code2 size={20} strokeWidth={1.5} />, line: 'Code, review, ship' },
  { id: 'creator', label: 'Creator', icon: <Palette size={20} strokeWidth={1.5} />, line: 'Design, video, writing' },
  { id: 'professional', label: 'Professional', icon: <Briefcase size={20} strokeWidth={1.5} />, line: 'Docs, email, analysis' },
  { id: 'student', label: 'Student', icon: <GraduationCap size={20} strokeWidth={1.5} />, line: 'Study, research, notes' },
  { id: 'entrepreneur', label: 'Entrepreneur', icon: <Rocket size={20} strokeWidth={1.5} />, line: 'Run and grow a business' },
]

export function Onboarding() {
  const nav = useNavigate()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('Maya')
  const [roles, setRoles] = useState<string[]>(['developer', 'creator'])
  const [tools, setTools] = useState<string[]>(['vscode', 'figma', 'gsheets'])
  const total = 3
  const canNext = step === 0 ? name.trim().length > 0 : step === 1 ? roles.length > 0 : true

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-canvas">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4 lg:px-8">
        <Logo product="Consumer" />
        <div className="flex items-center gap-3">
          <span className="text-label-sm text-fg-muted">About you · {step + 1} of {total}</span>
          <ThemeToggle />
        </div>
      </header>
      <ProgressBar value={((step + 1) / total) * 100} label="Onboarding progress" className="h-0.5 rounded-none" />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-12 lg:py-16">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}>
            {step === 0 && (
              <>
                <h1 className="text-headline-lg text-fg">Let’s personalise your assessment.</h1>
                <p className="mt-2 text-body-lg text-fg-2">Two quick questions so recommendations speak your language.</p>
                <div className="mt-8 max-w-sm">
                  <TextInput label="What should we call you?" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
                </div>
              </>
            )}
            {step === 1 && (
              <>
                <h1 className="text-headline-lg text-fg">What best describes you, {name}?</h1>
                <p className="mt-2 text-body-lg text-fg-2">Pick all that apply. This shapes which tools we consider.</p>
                <div role="group" aria-label="Roles" className="mt-8 grid gap-2 sm:grid-cols-2">
                  {ROLES.map((r) => {
                    const on = roles.includes(r.id)
                    return (
                      <button
                        key={r.id}
                        role="checkbox"
                        aria-checked={on}
                        onClick={() => setRoles(on ? roles.filter((x) => x !== r.id) : [...roles, r.id])}
                        className={cn('flex items-center gap-4 rounded-md border px-4 py-4 text-left transition-[border-color,background-color] duration-150', on ? 'border-accent bg-accent-subtle' : 'border-line bg-surface hover:border-line-strong')}
                      >
                        <span className={cn(on ? 'text-accent' : 'text-fg-muted')}>{r.icon}</span>
                        <span>
                          <span className="block text-body-md font-medium text-fg">{r.label}</span>
                          <span className="block text-body-sm text-fg-muted">{r.line}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </>
            )}
            {step === 2 && (
              <>
                <h1 className="text-headline-lg text-fg">What do you already use every day?</h1>
                <p className="mt-2 text-body-lg text-fg-2">We prefer tools that plug into what you have, over ones that replace it.</p>
                <div className="mt-8">
                  <ChoiceGroup
                    label="Current tools"
                    multiple
                    columns={2}
                    value={tools}
                    onChange={setTools}
                    options={[
                      { value: 'vscode', label: 'VS Code' },
                      { value: 'figma', label: 'Figma' },
                      { value: 'gsheets', label: 'Google Workspace' },
                      { value: 'office', label: 'Microsoft 365' },
                      { value: 'notion', label: 'Notion' },
                      { value: 'slack', label: 'Slack' },
                      { value: 'adobe', label: 'Adobe Creative Cloud' },
                      { value: 'none', label: 'Mostly a browser' },
                    ]}
                  />
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
        <div className="mt-auto flex items-center justify-between gap-3 pt-12">
          <Button variant="ghost" icon={<ArrowLeft size={14} />} onClick={() => (step === 0 ? nav('/') : setStep(step - 1))}>
            Back
          </Button>
          <Button variant="primary" size="lg" disabled={!canNext} iconRight={<ArrowRight size={16} />} onClick={() => (step < total - 1 ? setStep(step + 1) : nav('/assessment'))}>
            {step < total - 1 ? 'Continue' : 'Start assessment'}
          </Button>
        </div>
      </main>
    </div>
  )
}
