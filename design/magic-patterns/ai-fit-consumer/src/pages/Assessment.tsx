import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import { Button, ChoiceGroup, EngineProgress, Logo, ProgressBar, StageRail, ThemeToggle } from '../ds'
import { useConsumer } from '../store'

interface Question {
  id: string
  stage: 'understand' | 'decide'
  prompt: string
  help: string
  multiple?: boolean
  options: { value: string; label: string; description?: string }[]
}

const QUESTIONS: Question[] = [
  {
    id: 'goal',
    stage: 'understand',
    prompt: 'What do you most want AI to help with?',
    help: 'Pick up to three. We’ll prioritise the first.',
    multiple: true,
    options: [
      { value: 'code', label: 'Write and review code' },
      { value: 'docs', label: 'Draft documents and email' },
      { value: 'design', label: 'Create images or designs' },
      { value: 'research', label: 'Research and summarise' },
      { value: 'reports', label: 'Assemble recurring reports' },
      { value: 'admin', label: 'Admin: invoices, scheduling' },
    ],
  },
  {
    id: 'frequency',
    stage: 'understand',
    prompt: 'How often does this work come up?',
    help: 'Frequency decides whether setup time pays back.',
    options: [
      { value: 'daily', label: 'Every day', description: 'Several hours a week' },
      { value: 'weekly', label: 'A few times a week' },
      { value: 'monthly', label: 'Monthly or less', description: 'A simpler option is often better' },
    ],
  },
  {
    id: 'judgement',
    stage: 'understand',
    prompt: 'Is the task the same every time, or does it need judgement?',
    help: 'Rule-based tasks are usually better automated without AI.',
    options: [
      { value: 'same', label: 'Same steps every time', description: 'Same inputs, same output format' },
      { value: 'mixed', label: 'Mostly the same, some judgement' },
      { value: 'judgement', label: 'Different every time', description: 'Writing, creative or analytical work' },
    ],
  },
  {
    id: 'privacy',
    stage: 'understand',
    prompt: 'What kind of information will you share with AI tools?',
    help: 'This filters out tools that train on your inputs.',
    multiple: true,
    options: [
      { value: 'client', label: 'Client or employer work under NDA' },
      { value: 'personal', label: 'Personal data about others' },
      { value: 'own', label: 'Only my own projects' },
      { value: 'public', label: 'Public information' },
    ],
  },
  {
    id: 'budget',
    stage: 'understand',
    prompt: 'What’s your monthly budget for AI tools?',
    help: 'Total across all tools. We’ll stay under it.',
    options: [
      { value: '0', label: 'Free only' },
      { value: '30', label: 'Up to $30' },
      { value: '60', label: 'Up to $60' },
      { value: 'any', label: 'Whatever pays back' },
    ],
  },
  {
    id: 'comfort',
    stage: 'decide',
    prompt: 'How comfortable are you with technical setup?',
    help: 'We’ll match setup difficulty and how detailed your config is.',
    options: [
      { value: 'low', label: 'Keep it simple', description: 'Click-through setup only' },
      { value: 'mid', label: 'I can follow instructions', description: 'Settings files are fine' },
      { value: 'high', label: 'I live in the terminal', description: 'Scripts, CLIs, self-hosting' },
    ],
  },
]

const INITIAL: Record<string, string[]> = { goal: ['code', 'docs', 'reports'], frequency: ['daily'], judgement: ['mixed'], privacy: ['client'], budget: ['30'], comfort: ['high'] }

export function Assessment() {
  const nav = useNavigate()
  const { setAssessed } = useConsumer()
  const [i, setI] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string[]>>(INITIAL)
  const [running, setRunning] = useState(false)
  const q = QUESTIONS[i]
  const done = i === QUESTIONS.length - 1
  const minutesLeft = Math.max(1, Math.round(((QUESTIONS.length - i) / QUESTIONS.length) * 5))

  if (running) {
    return (
      <div className="flex h-full flex-col bg-canvas">
        <header className="flex h-14 shrink-0 items-center border-b border-line px-4 lg:px-8">
          <Logo product="Consumer" />
        </header>
        <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-12">
          <h1 className="text-headline-lg text-fg">Building your AI profile</h1>
          <p className="mt-2 mb-8 text-body-lg text-fg-2">This takes a few seconds. Here’s what’s happening.</p>
          <EngineProgress
            steps={['Reading your answers', 'Checking 140 tools against your privacy needs', 'Filtering to your $30 budget', 'Deciding where AI isn’t worth it', 'Ranking and writing explanations']}
            onDone={() => {
              setAssessed(true)
              nav('/app/profile')
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-canvas">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4 lg:px-8">
        <Logo product="Consumer" />
        <div className="flex items-center gap-3">
          <span className="hidden text-label-sm text-fg-muted sm:inline">About {minutesLeft} min left</span>
          <ThemeToggle />
          <Button variant="ghost" size="sm" aria-label="Save and exit" onClick={() => nav('/app')} icon={<X size={14} />}>
            <span className="hidden sm:inline">Save & exit</span>
          </Button>
        </div>
      </header>
      <div className="mx-auto w-full max-w-3xl px-4 pt-6">
        <StageRail current={q.stage} completed={q.stage === 'decide' ? ['understand'] : []} />
      </div>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-10">
        <div className="flex items-center gap-3">
          <span className="font-mono text-label-sm text-fg-muted">
            {i + 1}/{QUESTIONS.length}
          </span>
          <ProgressBar value={((i + 1) / QUESTIONS.length) * 100} label="Questions answered" className="max-w-40" />
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={q.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }} className="mt-6">
            <h1 className="text-headline-lg text-fg">{q.prompt}</h1>
            <p className="mt-2 text-body-lg text-fg-muted">{q.help}</p>
            <div className="mt-8">
              <ChoiceGroup label={q.prompt} size="lg" multiple={q.multiple} columns={q.options.length > 4 ? 2 : 1} value={answers[q.id] ?? []} onChange={(v) => setAnswers({ ...answers, [q.id]: q.multiple ? v.slice(0, 3) : v })} options={q.options} />
            </div>
          </motion.div>
        </AnimatePresence>
        <div className="mt-auto flex items-center justify-between pt-10">
          <Button variant="ghost" icon={<ArrowLeft size={14} />} onClick={() => (i === 0 ? nav('/onboarding') : setI(i - 1))}>
            Back
          </Button>
          <Button variant="primary" size="lg" disabled={!(answers[q.id]?.length)} iconRight={<ArrowRight size={16} />} onClick={() => (done ? setRunning(true) : setI(i + 1))}>
            {done ? 'See my results' : 'Next'}
          </Button>
        </div>
      </main>
    </div>
  )
}
