import React, { createContext, useContext, useMemo, useState } from 'react'
import type { ToolRecommendation } from './ds'
import { MORE_TOOLS, SAMPLE_TOOLS } from './ds/sample/consumer'

/**
 * Client-side prototype state. In production these values come from your own
 * API; no endpoint is assumed here.
 */
interface ConsumerState {
  tools: ToolRecommendation[]
  allTools: ToolRecommendation[]
  toggleSave: (id: string) => void
  planId: string
  setPlanId: (id: string) => void
  setupDone: string[]
  toggleSetup: (id: string) => void
  configTool: string
  setConfigTool: (id: string) => void
  assessed: boolean
  setAssessed: (v: boolean) => void
}

const Ctx = createContext<ConsumerState | null>(null)

export function ConsumerStoreProvider({ children }: { children: React.ReactNode }) {
  const [all, setAll] = useState<ToolRecommendation[]>([...SAMPLE_TOOLS.map((t, i) => ({ ...t, saved: i === 1 })), ...MORE_TOOLS])
  const [planId, setPlanId] = useState('consumer-free')
  const [setupDone, setSetupDone] = useState<string[]>(['install-cursor', 'privacy-mode'])
  const [configTool, setConfigTool] = useState('cursor')
  const [assessed, setAssessed] = useState(true)
  const value = useMemo<ConsumerState>(
    () => ({
      allTools: all,
      tools: all.slice(0, 3),
      toggleSave: (id) => setAll((ts) => ts.map((t) => (t.id === id ? { ...t, saved: !t.saved } : t))),
      planId,
      setPlanId,
      setupDone,
      toggleSetup: (id) => setSetupDone((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id])),
      configTool,
      setConfigTool,
      assessed,
      setAssessed,
    }),
    [all, planId, setupDone, configTool, assessed],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useConsumer() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useConsumer must be used inside ConsumerStoreProvider')
  return v
}

export const SETUP_STEPS = [
  { id: 'install-cursor', label: 'Install Cursor', tool: 'Cursor' },
  { id: 'privacy-mode', label: 'Turn on Privacy Mode', tool: 'Cursor' },
  { id: 'claude-controls', label: 'Review Claude data controls', tool: 'Claude' },
  { id: 'zap-import', label: 'Import weekly report Zap', tool: 'Zapier' },
  { id: 'first-run', label: 'Run your first workflow', tool: 'All' },
]
