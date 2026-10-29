'use client'

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import type { Theme } from './types'

export const THEME_STORAGE_KEY = 'aifit-theme'

/**
 * Inline before first paint (in <head>), so the page never flashes the wrong
 * theme. Saved choice wins; otherwise the system preference; otherwise dark.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}document.documentElement.classList.toggle('dark',t==='dark');document.documentElement.dataset.theme=t}catch(e){document.documentElement.classList.add('dark')}})();`

const ThemeCtx = createContext<{ theme: Theme; setTheme: (t: Theme) => void }>({ theme: 'dark', setTheme: () => {} })

function currentTheme(): Theme {
  if (typeof document === 'undefined') return 'dark'
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

/** The class lives on <html> so portals inherit it. The boot script sets it before hydration. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark')
  useEffect(() => setThemeState(currentTheme()), [])
  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    document.documentElement.classList.toggle('dark', t === 'dark')
    document.documentElement.dataset.theme = t
    try {
      localStorage.setItem(THEME_STORAGE_KEY, t)
    } catch {
      /* storage unavailable: the choice lasts for this page only */
    }
  }, [])
  return <ThemeCtx.Provider value={{ theme, setTheme }}>{children}</ThemeCtx.Provider>
}

export const useTheme = () => useContext(ThemeCtx)

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const next = theme === 'dark' ? 'light' : 'dark'
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} theme`}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-sm text-fg-muted hover:bg-sunken hover:text-fg transition-colors duration-150 ${className}`}
    >
      {theme === 'dark' ? <Sun size={16} strokeWidth={1.5} /> : <Moon size={16} strokeWidth={1.5} />}
    </button>
  )
}
