import React from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Building2,
  ChevronsUpDown,
  ClipboardList,
  CreditCard,
  FileStack,
  FlaskConical,
  Gauge,
  GitFork,
  History,
  Landmark,
  LayoutDashboard,
  Map,
  Network,
  Cpu,
  Scale,
  Server,
  Settings,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'
import { AppShell } from '../ds'
import { SAMPLE_ORG } from '../ds/sample/teams'

const ic = { size: 16, strokeWidth: 1.5 }
const NAV = [
  {
    items: [
      { id: '', label: 'Overview', icon: <LayoutDashboard {...ic} /> },
      { id: 'workspace', label: 'Workload portfolio', icon: <FileStack {...ic} />, badge: '6' },
      { id: 'intake', label: 'New intake', icon: <ClipboardList {...ic} /> },
    ],
  },
  {
    label: 'Decide',
    items: [
      { id: 'verdict', label: 'Suitability verdict', icon: <Gauge {...ic} /> },
      { id: 'build-vs-buy', label: 'Build vs buy', icon: <GitFork {...ic} /> },
      { id: 'cost', label: 'Cost model', icon: <Wallet {...ic} /> },
      { id: 'roi', label: 'ROI assumptions', icon: <TrendingUp {...ic} /> },
    ],
  },
  {
    label: 'Configure',
    items: [
      { id: 'architecture', label: 'Architecture', icon: <Network {...ic} /> },
      { id: 'models', label: 'Model comparison', icon: <Cpu {...ic} /> },
      { id: 'infrastructure', label: 'Infrastructure', icon: <Server {...ic} /> },
      { id: 'blueprint', label: 'Blueprint', icon: <Landmark {...ic} /> },
    ],
  },
  {
    label: 'Validate',
    items: [
      { id: 'governance', label: 'Governance', icon: <Scale {...ic} /> },
      { id: 'security', label: 'Security', icon: <ShieldCheck {...ic} /> },
      { id: 'risks', label: 'Risk register', icon: <ShieldAlert {...ic} />, badge: '7' },
      { id: 'evaluation', label: 'Evaluation plan', icon: <FlaskConical {...ic} /> },
    ],
  },
  {
    label: 'Improve',
    items: [
      { id: 'roadmap', label: 'Roadmap', icon: <Map {...ic} /> },
      { id: 'history', label: 'Assessment history', icon: <History {...ic} /> },
    ],
  },
  {
    label: 'Organization',
    items: [
      { id: 'admin', label: 'Team', icon: <Users {...ic} /> },
      { id: 'billing', label: 'Billing', icon: <CreditCard {...ic} /> },
      { id: 'settings', label: 'Settings', icon: <Settings {...ic} /> },
    ],
  },
]

export function TeamsShell() {
  const nav = useNavigate()
  const loc = useLocation()
  const active = loc.pathname.replace(/^\/app\/?/, '')
  return (
    <AppShell
      product="Teams"
      nav={NAV}
      active={active}
      onNavigate={(id) => nav(`/app/${id}`)}
      sidebarHeader={
        <button className="flex w-full items-center gap-2.5 rounded-sm border border-line px-2 py-1.5 text-left transition-colors duration-150 hover:bg-sunken">
          <span className="flex h-6 w-6 items-center justify-center rounded-xs bg-sunken text-fg-muted">
            <Building2 size={13} strokeWidth={1.5} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-label-md text-fg">{SAMPLE_ORG.name}</span>
            <span className="block text-label-sm text-fg-muted">Workspace plan</span>
          </span>
          <ChevronsUpDown size={14} className="text-fg-muted" />
        </button>
      }
      sidebarFooter={
        <div className="flex items-center gap-2.5 p-1.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sunken text-label-sm text-fg">JR</span>
          <span className="min-w-0">
            <span className="block truncate text-label-md text-fg">Jordan Reyes</span>
            <span className="block text-label-sm text-fg-muted">Owner</span>
          </span>
        </div>
      }
    >
      <div className="mx-auto w-full max-w-[1440px] px-4 py-6 lg:px-8 lg:py-8">
        <Outlet />
      </div>
    </AppShell>
  )
}
