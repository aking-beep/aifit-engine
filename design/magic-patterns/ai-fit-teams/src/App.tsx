import React from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ThemeProvider, ToastProvider } from './ds'
import { TeamsShell } from './layout/TeamsShell'
import { TeamsLanding } from './pages/TeamsLanding'
import { OrgOnboarding } from './pages/OrgOnboarding'
import { TeamsDashboard } from './pages/TeamsDashboard'
import { Workspace } from './pages/Workspace'
import { Intake } from './pages/Intake'
import { Verdict } from './pages/Verdict'
import { BuildVsBuy } from './pages/BuildVsBuy'
import { CostModel } from './pages/CostModel'
import { Roi } from './pages/Roi'
import { Architecture } from './pages/Architecture'
import { Models } from './pages/Models'
import { Infrastructure } from './pages/Infrastructure'
import { Governance } from './pages/Governance'
import { Security } from './pages/Security'
import { RiskRegister } from './pages/RiskRegister'
import { Evaluation } from './pages/Evaluation'
import { Roadmap } from './pages/Roadmap'
import { Blueprint } from './pages/Blueprint'
import { TeamsHistory } from './pages/TeamsHistory'
import { Admin } from './pages/Admin'
import { Billing } from './pages/Billing'
import { TeamsSettings } from './pages/TeamsSettings'

/**
 * AI Fit Teams — interactive prototype. Sample organisation, no live integrations.
 */
export function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={<TeamsLanding />} />
            <Route path="/onboarding" element={<OrgOnboarding />} />
            <Route path="/app" element={<TeamsShell />}>
              <Route index element={<TeamsDashboard />} />
              <Route path="workspace" element={<Workspace />} />
              <Route path="intake" element={<Intake />} />
              <Route path="verdict" element={<Verdict />} />
              <Route path="build-vs-buy" element={<BuildVsBuy />} />
              <Route path="cost" element={<CostModel />} />
              <Route path="roi" element={<Roi />} />
              <Route path="architecture" element={<Architecture />} />
              <Route path="models" element={<Models />} />
              <Route path="infrastructure" element={<Infrastructure />} />
              <Route path="governance" element={<Governance />} />
              <Route path="security" element={<Security />} />
              <Route path="risks" element={<RiskRegister />} />
              <Route path="evaluation" element={<Evaluation />} />
              <Route path="roadmap" element={<Roadmap />} />
              <Route path="blueprint" element={<Blueprint />} />
              <Route path="history" element={<TeamsHistory />} />
              <Route path="admin" element={<Admin />} />
              <Route path="billing" element={<Billing />} />
              <Route path="settings" element={<TeamsSettings />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </ThemeProvider>
  )
}
