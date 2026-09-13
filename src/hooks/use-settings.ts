import { useEffect, useState } from 'react'

import type { UnitEditorMode } from './combat-setup/combat-setup'

export type Theme = 'system' | 'dark' | 'light'

export type Precision = { kind: 'limited' | 'full'; digits: number }

export type Settings = {
  theme: Theme
  precision: Precision
  editorMode: UnitEditorMode
}

const STORAGE_KEY = 'settings'
const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  precision: { kind: 'limited', digits: 2 },
  editorMode: 'SIMPLIFIED',
}

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    // ignore malformed JSON
  }
  return DEFAULT_SETTINGS
}

export function useSettings() {
  const [settings, setSettings] = useState(loadSettings)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  }, [settings])

  return [settings, setSettings] as const
}
