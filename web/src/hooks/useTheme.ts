import { useState, useEffect, useCallback } from 'react'

export type ThemeId = 'default' | 'obsidian' | 'concrete' | 'phosphor' | 'blossom' | 'ember' | 'slate'

export interface Theme {
  id: ThemeId
  name: string
  description: string
  preview: {
    bg: string
    fg: string
    accent: string
  }
}

export const themes: Theme[] = [
  {
    id: 'default',
    name: 'Command',
    description: 'Deep slate with cyan accents',
    preview: { bg: '#0f1318', fg: '#e8ecf0', accent: '#22c5d6' },
  },
  {
    id: 'obsidian',
    name: 'Obsidian',
    description: 'Purple/violet dark theme',
    preview: { bg: '#0d0a14', fg: '#ebe9ed', accent: '#a855f7' },
  },
  {
    id: 'concrete',
    name: 'Concrete',
    description: 'Brutalist light with sharp edges',
    preview: { bg: '#f5f5f5', fg: '#141414', accent: '#141414' },
  },
  {
    id: 'phosphor',
    name: 'Phosphor',
    description: 'Terminal hacker green on black',
    preview: { bg: '#080d08', fg: '#80ff80', accent: '#00ff00' },
  },
  {
    id: 'blossom',
    name: 'Blossom',
    description: 'Soft pastel pink/rose',
    preview: { bg: '#fdf6f7', fg: '#3d2c2f', accent: '#ec4899' },
  },
  {
    id: 'ember',
    name: 'Ember',
    description: 'Warm cozy with orange/amber',
    preview: { bg: '#151110', fg: '#efe5db', accent: '#f97316' },
  },
  {
    id: 'slate',
    name: 'Slate',
    description: 'Corporate minimal light',
    preview: { bg: '#f8fafc', fg: '#1e293b', accent: '#3b82f6' },
  },
]

const STORAGE_KEY = 'workspace-theme'

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    if (typeof window === 'undefined') return 'default'
    const stored = localStorage.getItem(STORAGE_KEY)
    return (stored as ThemeId) || 'default'
  })

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'default') {
      root.removeAttribute('data-theme')
    } else {
      root.setAttribute('data-theme', theme)
    }
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const setTheme = useCallback((newTheme: ThemeId) => {
    setThemeState(newTheme)
  }, [])

  return { theme, setTheme, themes }
}
