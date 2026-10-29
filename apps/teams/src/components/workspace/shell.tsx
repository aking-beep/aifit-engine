'use client';

import { usePathname } from 'next/navigation';
import { ClipboardList, CreditCard, FolderKanban, History, LayoutDashboard, Plus, Settings, Users } from 'lucide-react';
import { AppShell, DLink, type NavGroup } from '@/design';
import { SignOutButton, WorkspaceSwitcher } from './controls';

const NAV: NavGroup[] = [
  { items: [
    { id: 'overview', label: 'Overview', href: '/workspace', icon: <LayoutDashboard size={15} /> },
    { id: 'portfolio', label: 'Portfolio', href: '/workspace/portfolio', icon: <FolderKanban size={15} /> },
    { id: 'new', label: 'New assessment', href: '/assess', icon: <ClipboardList size={15} /> },
  ] },
  { label: 'Organization', items: [
    { id: 'history', label: 'History', href: '/workspace/history', icon: <History size={15} /> },
    { id: 'admin', label: 'Members', href: '/workspace/admin', icon: <Users size={15} /> },
    { id: 'billing', label: 'Billing', href: '/workspace/billing', icon: <CreditCard size={15} /> },
    { id: 'settings', label: 'Settings', href: '/workspace/settings', icon: <Settings size={15} /> },
  ] },
];

function activeFor(path: string): string {
  if (path.startsWith('/workspace/assessments') || path.startsWith('/workspace/portfolio')) return 'portfolio';
  for (const id of ['history', 'admin', 'billing', 'settings'] as const) if (path.startsWith(`/workspace/${id}`)) return id;
  return 'overview';
}

export function WorkspaceShell({ user, org, orgs, children }: {
  user: { name: string; email: string };
  org: { id: string; name: string; role: string };
  orgs: { id: string; name: string; role: string }[];
  children: React.ReactNode;
}) {
  const path = usePathname() ?? '/workspace';
  const initials = user.name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase() || '?';
  return (
    <AppShell
      product="Teams"
      nav={NAV}
      active={activeFor(path)}
      homeHref="/workspace"
      contentClassName="px-4 py-6 lg:px-8"
      sidebarHeader={
        orgs.length > 1 ? <WorkspaceSwitcher orgs={orgs} activeId={org.id} /> : (
          <div className="rounded-sm border border-line px-2.5 py-2">
            <p className="truncate text-label-md text-fg">{org.name}</p>
            <p className="text-label-sm text-fg-muted">Your role: {org.role}</p>
          </div>
        )
      }
      sidebarFooter={
        <div className="space-y-2">
          <DLink href="/account" className="flex items-center gap-2.5 rounded-sm p-1 hover:bg-sunken">
            <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-full bg-sunken font-mono text-label-sm text-fg-2">{initials}</span>
            <span className="min-w-0">
              <span className="block truncate text-label-md text-fg">{user.name}</span>
              <span className="block truncate text-label-sm text-fg-muted">{user.email}</span>
            </span>
          </DLink>
          <SignOutButton />
        </div>
      }
      topRight={
        <DLink href="/assess" className="inline-flex h-8 items-center gap-1.5 rounded-sm bg-accent px-3 text-label-md text-on-accent hover:bg-accent/90">
          <Plus size={14} aria-hidden /> New assessment
        </DLink>
      }
    >
      <div className="mx-auto max-w-6xl">{children}</div>
    </AppShell>
  );
}
