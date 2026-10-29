import React, { useState } from 'react'
import { Blocks, Boxes, FileCode2, LayoutGrid, Palette, Type, Waypoints } from 'lucide-react'
import { AppShell, ThemeProvider, ToastProvider } from './ds'
import { Foundations } from './docs/Foundations'
import { DecisionDocs } from './docs/DecisionDocs'
import { InputDocs } from './docs/InputDocs'
import { DataDocs } from './docs/DataDocs'
import { CommercialDocs } from './docs/CommercialDocs'
import { FeedbackDocs } from './docs/FeedbackDocs'
import { Principles } from './docs/Principles'

const NAV = [
  {
    label: 'Foundations',
    items: [
      { id: 'principles', label: 'Principles', icon: <Waypoints size={16} strokeWidth={1.5} /> },
      { id: 'foundations', label: 'Tokens', icon: <Palette size={16} strokeWidth={1.5} /> },
    ],
  },
  {
    label: 'Components',
    items: [
      { id: 'decision', label: 'Decision & evidence', icon: <Type size={16} strokeWidth={1.5} /> },
      { id: 'inputs', label: 'Forms & assessment', icon: <LayoutGrid size={16} strokeWidth={1.5} /> },
      { id: 'data', label: 'Data & diagrams', icon: <Boxes size={16} strokeWidth={1.5} /> },
      { id: 'commercial', label: 'Pricing & downloads', icon: <FileCode2 size={16} strokeWidth={1.5} /> },
      { id: 'feedback', label: 'Feedback & overlays', icon: <Blocks size={16} strokeWidth={1.5} /> },
    ],
  },
]

export function App() {
  const [page, setPage] = useState('principles')
  return (
    <ThemeProvider>
      <ToastProvider>
        <AppShell product="Design System" nav={NAV} active={page} onNavigate={setPage}>
          <div className="mx-auto max-w-5xl px-4 py-8 lg:px-8 lg:py-10">
            {page === 'principles' && <Principles />}
            {page === 'foundations' && <Foundations />}
            {page === 'decision' && <DecisionDocs />}
            {page === 'inputs' && <InputDocs />}
            {page === 'data' && <DataDocs />}
            {page === 'commercial' && <CommercialDocs />}
            {page === 'feedback' && <FeedbackDocs />}
          </div>
        </AppShell>
      </ToastProvider>
    </ThemeProvider>
  )
}
