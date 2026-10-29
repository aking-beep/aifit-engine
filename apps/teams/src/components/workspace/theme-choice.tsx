'use client';

import { Toggle, useTheme } from '@/design';

export function ThemeChoice() {
  const { theme, setTheme } = useTheme();
  return <Toggle checked={theme === 'dark'} onChange={(on) => setTheme(on ? 'dark' : 'light')} label="Dark theme" description="Saved in this browser." />;
}
