import { isDeepEqual } from 'remeda'

import type { GameSystem, UnitBaseType, UnitSelection } from '@/types'

export interface SerializedConfig {
  v: 1
  g: GameSystem
  af: string
  df: string
  m: 'S' | 'G'
  au: Record<string, [number, 0 | 1]>
  du: Record<string, [number, 0 | 1]>
  aa: Record<string, Record<string, unknown>>
  da: Record<string, Record<string, unknown>>
}

export function serializeUnits(
  selections: Record<UnitBaseType, UnitSelection>,
): Record<string, [number, 0 | 1]> {
  const result: Record<string, [number, 0 | 1]> = {}
  for (const [type, sel] of Object.entries(selections)) {
    if (sel.count > 0) {
      result[type] = [sel.count, sel.upgraded ? 1 : 0]
    }
  }
  return result
}

export function serializeAbilities(
  config: Record<string, Record<string, unknown>>,
  reconciledDefaults: Record<string, Record<string, unknown>>,
): Record<string, Record<string, unknown>> {
  const result: Record<string, Record<string, unknown>> = {}
  for (const [key, params] of Object.entries(config)) {
    if (key === 'SETTINGS') continue
    const defaults = reconciledDefaults[key]
    if (!defaults) continue
    const diff: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(params)) {
      if (!isDeepEqual(v, defaults[k])) {
        diff[k] = v
      }
    }
    if (Object.keys(diff).length > 0) {
      result[key] = diff
    }
  }
  return result
}
