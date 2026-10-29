import React from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Bookmark, CreditCard, GitCompare, History, Home, LayoutList, Settings, Settings2, ArrowUpRight, UserRound, Workflow } from 'lucide-react'
import { AppShell, Button, planById } from '../ds'
import { SAMPLE_USER } from '../ds/sample/consumer'
import { useConsumer } from '../store'

const ic = { size: 16, strokeWidth: 1.5 }
const NAV = [
  {
    items: [
      { id: '', label: 'Home', icon: <Home {...ic} /> },
      { id: 'profile', label: 'AI profile', icon: <UserRound {...ic} /> },
    ],
  },
  {
    label: 'Recommendations',
    items: [
      { id: 'tools', label: 'Recommended tools', icon: <LayoutList {...ic} /> },
      { id: 'compare', label: 'Compare', icon: <GitCompare {...ic} /> },
      { id: 'workflows', label: 'Workflows', icon: <Workflow {...ic} /> },
      { id: 'saved', label: 'Saved', icon: <Bookmark {...ic} /> },
    ],
  },
  {
    label: 'Set up',
    items: [
      { id: 'configure', label: 'Configurations', icon: <Settings2 {...ic} /> },
      { id: 'history', label: 'Assessment history', icon: <History {...ic} /> },
    ],
  },
  {
    label: 'Account',
    items: [
      { id: 'subscription', label: 'Subscription', icon: <CreditCard {...ic} /> },
      { id: 'settings', label: 'Settings', icon: <Settings {...ic} /> },
    ],
  },
]

export function ConsumerShell() {
  const nav = useNavigate()
  const loc = useLocation()
  const { planId } = useConsumer()
  const active = loc.pathname.replace(/^\/app\/?/, '')
  const plan = planById(planId)
  return (
    <AppShell
      product="Consumer"
      nav={NAV}
      active={active}
      onNavigate={(id) => nav(`/app/${id}`)}
      topRight={
        planId === 'consumer-free' ? (
          <Button size="sm" onClick={() => nav('/app/upgrade')} iconRight={<ArrowUpRight size={13} strokeWidth={1.5} />} className="hidden sm:inline-flex">
            Upgrade
          </Button>
        ) : null
      }
      sidebarFooter={
        <button onClick={() => nav('/app/settings')} className="flex w-full items-center gap-2.5 rounded-sm p-1.5 text-left transition-colors duration-150 hover:bg-sunken">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sunken text-label-sm text-fg">MC</span>
          <span className="min-w-0">
            <span className="block truncate text-label-md text-fg">{SAMPLE_USER.name}</span>
            <span className="block text-label-sm text-fg-muted">{plan?.name} plan</span>
          </span>
        </button>
      }
    >
      <div className="mx-auto w-full max-w-5xl px-4 py-8 lg:px-8 lg:py-10">
        <Outlet />
      </div>
    </AppShell>
  )
}
