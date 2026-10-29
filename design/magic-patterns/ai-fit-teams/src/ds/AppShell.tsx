import React, { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { ThemeToggle } from './Theme'
import { SampleDataTag } from './Feedback'
import { cn } from './lib'

export interface NavItem {
  id: string
  label: string
  icon: React.ReactNode
  badge?: string
}
export interface NavGroup {
  label?: string
  items: NavItem[]
}

/** Product mark. Two squares = one engine, two depths. No AI imagery. */
export function Logo({ product }: { product: 'Consumer' | 'Teams' | 'Design System' }) {
  return (
    <span className="flex items-center gap-2">
      <span aria-hidden className="relative h-5 w-5">
        <span className="absolute top-0 left-0 h-3 w-3 rounded-[3px] bg-fg" />
        <span className="absolute right-0 bottom-0 h-3 w-3 rounded-[3px] border-[1.5px] border-accent bg-canvas" />
      </span>
      <span className="text-label-md text-fg">
        AI Fit <span className="text-fg-muted">{product === 'Consumer' ? '' : product}</span>
      </span>
    </span>
  )
}

/**
 * App shell: 240px sidebar → hidden below lg with a slide-in sheet,
 * 56px top bar with sample-data tag and theme switch.
 */
export function AppShell({
  product,
  nav,
  active,
  onNavigate,
  topRight,
  sidebarFooter,
  sidebarHeader,
  children,
  contentClassName,
}: {
  product: 'Consumer' | 'Teams' | 'Design System'
  nav: NavGroup[]
  active: string
  onNavigate: (id: string) => void
  topRight?: React.ReactNode
  sidebarFooter?: React.ReactNode
  sidebarHeader?: React.ReactNode
  children: React.ReactNode
  contentClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const activeLabel = nav.flatMap((g) => g.items).find((i) => i.id === active)?.label

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center px-4">
        <Logo product={product} />
      </div>
      {sidebarHeader && <div className="px-3 pb-2">{sidebarHeader}</div>}
      <nav className="flex-1 overflow-y-auto px-2 pb-4" aria-label="Main">
        {nav.map((g, gi) => (
          <div key={gi} className="mt-4 first:mt-1">
            {g.label && <p className="px-2 pb-1.5 text-label-sm text-fg-muted">{g.label}</p>}
            <ul className="flex flex-col gap-px">
              {g.items.map((it) => (
                <li key={it.id}>
                  <button
                    onClick={() => {
                      onNavigate(it.id)
                      setOpen(false)
                    }}
                    aria-current={active === it.id ? 'page' : undefined}
                    className={cn(
                      'flex h-8 w-full items-center gap-2.5 rounded-sm px-2 text-label-md transition-colors duration-150',
                      active === it.id ? 'bg-sunken text-fg' : 'text-fg-muted hover:bg-sunken/60 hover:text-fg',
                    )}
                  >
                    <span className={cn('shrink-0', active === it.id && 'text-accent')}>{it.icon}</span>
                    <span className="truncate">{it.label}</span>
                    {it.badge && <span className="ml-auto font-mono text-label-sm text-fg-muted">{it.badge}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      {sidebarFooter && <div className="border-t border-line p-3">{sidebarFooter}</div>}
    </div>
  )

  return (
    <div className="flex h-full w-full overflow-hidden bg-canvas">
      <aside className="hidden w-60 shrink-0 border-r border-line bg-surface lg:block">{sidebar}</aside>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="absolute inset-0 bg-canvas/60" onClick={() => setOpen(false)} />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
              className="absolute inset-y-0 left-0 w-72 border-r border-line bg-surface"
            >
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="absolute top-3.5 right-3 rounded-sm p-1 text-fg-muted hover:text-fg">
                <X size={16} />
              </button>
              {sidebar}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-canvas px-4 lg:px-6">
          <button onClick={() => setOpen(true)} aria-label="Open menu" className="-ml-1 rounded-sm p-1.5 text-fg-muted hover:bg-sunken hover:text-fg lg:hidden">
            <Menu size={18} />
          </button>
          <p className="min-w-0 truncate text-label-md text-fg">{activeLabel}</p>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden sm:inline-flex">
              <SampleDataTag />
            </span>
            {topRight}
            <ThemeToggle />
          </div>
        </header>
        <main className={cn('min-h-0 flex-1 overflow-y-auto', contentClassName)}>{children}</main>
      </div>
    </div>
  )
}
