'use client'
// GENERATED from packages/design by scripts/sync-design.mjs. Do not edit here.

import React, { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check, Info, X, AlertTriangle } from 'lucide-react'
import { cn } from './lib'

const EASE = [0.23, 1, 0.32, 1] as const

/** Portals need document.body, which exists only after mount (SSR-safe). */
function subscribeNever() {
  return () => {}
}
function useMounted() {
  return useSyncExternalStore(subscribeNever, () => true, () => false)
}

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
}

/** Modal — level 3. 240ms enter from scale 0.96. */
export function Modal({ open, onClose, title, description, children, footer, size = 'md' }: { open: boolean; onClose: () => void; title: string; description?: string; children?: React.ReactNode; footer?: React.ReactNode; size?: 'sm' | 'md' | 'lg' }) {
  useEscape(open, onClose)
  const reduce = useReducedMotion()
  const mounted = useMounted()
  if (!mounted) return null
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="absolute inset-0 bg-canvas/60 backdrop-blur-[2px]" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 4 }}
            transition={{ duration: 0.24, ease: EASE }}
            className={cn(
              'relative flex max-h-[90%] w-full flex-col rounded-t-lg border border-line bg-raised shadow-pop sm:rounded-lg',
              size === 'sm' && 'sm:max-w-md',
              size === 'md' && 'sm:max-w-lg',
              size === 'lg' && 'sm:max-w-3xl',
            )}
          >
            <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
              <div>
                <h2 className="text-headline-md text-fg">{title}</h2>
                {description && <p className="mt-1 text-body-sm text-fg-muted">{description}</p>}
              </div>
              <button onClick={onClose} aria-label="Close" className="-mr-1 rounded-sm p-1 text-fg-muted transition-colors duration-150 hover:bg-sunken hover:text-fg">
                <X size={16} />
              </button>
            </header>
            {children && <div className="overflow-y-auto px-5 py-4">{children}</div>}
            {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/** Right-side detail drawer — progressive disclosure for reasoning and evidence. */
export function Drawer({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  useEscape(open, onClose)
  const reduce = useReducedMotion()
  const mounted = useMounted()
  if (!mounted) return null
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="absolute inset-0 bg-canvas/60" onClick={onClose} />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={reduce ? { opacity: 0 } : { x: '100%' }}
            animate={reduce ? { opacity: 1 } : { x: 0 }}
            exit={reduce ? { opacity: 0 } : { x: '100%' }}
            transition={{ duration: 0.26, ease: EASE }}
            className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-line bg-raised shadow-pop"
          >
            <header className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <h2 className="text-title-md text-fg">{title}</h2>
              <button onClick={onClose} aria-label="Close" className="rounded-sm p-1 text-fg-muted transition-colors duration-150 hover:bg-sunken hover:text-fg">
                <X size={16} />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
            {footer && <footer className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer>}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/* ---------- Notifications ---------- */

type Toast = { id: number; title: string; body?: string; tone: 'info' | 'success' | 'warn' }
const ToastCtx = createContext<(t: Omit<Toast, 'id'>) => void>(() => {})

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random()
    setToasts((ts) => [...ts, { ...t, id }])
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 4000)
  }, [])
  const mounted = useMounted()
  return (
    <ToastCtx.Provider value={push}>
      {children}
      {mounted && createPortal(
        <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 left-4 z-[60] flex flex-col items-end gap-2 sm:left-auto">
          <AnimatePresence>
            {toasts.map((t) => (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2, ease: EASE }}
                className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-md border border-line bg-raised px-4 py-3 shadow-pop"
              >
                {t.tone === 'success' ? <Check size={16} className="mt-0.5 text-accent" /> : t.tone === 'warn' ? <AlertTriangle size={16} className="mt-0.5 text-warn" /> : <Info size={16} className="mt-0.5 text-fg-muted" />}
                <div className="min-w-0 flex-1">
                  <p className="text-label-md text-fg">{t.title}</p>
                  {t.body && <p className="mt-0.5 text-body-sm text-fg-muted">{t.body}</p>}
                </div>
                <button aria-label="Dismiss" onClick={() => setToasts((ts) => ts.filter((x) => x.id !== t.id))} className="text-fg-muted hover:text-fg">
                  <X size={14} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>,
        document.body,
      )}
    </ToastCtx.Provider>
  )
}

export const useToast = () => useContext(ToastCtx)
