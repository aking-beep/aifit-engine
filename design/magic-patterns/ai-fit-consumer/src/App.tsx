import React from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ThemeProvider, ToastProvider } from './ds'
import { ConsumerStoreProvider } from './store'
import { ConsumerShell } from './layout/ConsumerShell'
import { Landing } from './pages/Landing'
import { Onboarding } from './pages/Onboarding'
import { Assessment } from './pages/Assessment'
import { Dashboard } from './pages/Dashboard'
import { Profile } from './pages/Profile'
import { Tools } from './pages/Tools'
import { Compare } from './pages/Compare'
import { Workflows } from './pages/Workflows'
import { Configure } from './pages/Configure'
import { Saved } from './pages/Saved'
import { History } from './pages/History'
import { Upgrade } from './pages/Upgrade'
import { Subscription } from './pages/Subscription'
import { Settings } from './pages/Settings'

/**
 * AI Fit Consumer — interactive prototype.
 * Marketing and the assessment flow are full-screen; everything after sign-in
 * lives in the app shell. All content is sample data.
 */
export function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <ConsumerStoreProvider>
          <MemoryRouter initialEntries={['/']}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/assessment" element={<Assessment />} />
              <Route path="/app" element={<ConsumerShell />}>
                <Route index element={<Dashboard />} />
                <Route path="profile" element={<Profile />} />
                <Route path="tools" element={<Tools />} />
                <Route path="compare" element={<Compare />} />
                <Route path="workflows" element={<Workflows />} />
                <Route path="configure" element={<Configure />} />
                <Route path="saved" element={<Saved />} />
                <Route path="history" element={<History />} />
                <Route path="upgrade" element={<Upgrade />} />
                <Route path="subscription" element={<Subscription />} />
                <Route path="settings" element={<Settings />} />
              </Route>
            </Routes>
          </MemoryRouter>
        </ConsumerStoreProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
