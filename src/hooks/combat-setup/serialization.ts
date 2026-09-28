import { isDeepEqual } from 'remeda'

import type { GameSystem, SurfaceUnitCounts, UnitBaseType } from '@/types'

export type SerializedSurfaceCounts = Record<string, Record<string, number>>

/** Share-link config. Validation converts older (v1) links to this form. */
export interface SerializedConfig {
  v: 2
  g: GameSystem
  af: string
  df: string
  m: 'S' | 'G'
  e: 'S' | 'F'
  p: string[]
  sp: string
  asu: SerializedSurfaceCounts
  dsu: SerializedSurfaceCounts
  aup: UnitBaseType[]
  dup: UnitBaseType[]
  aa: Record<string, Record<string, unknown>>
  da: Record<string, Record<string, unknown>>
}

export function serializeSurfaceCounts(
  counts: SurfaceUnitCounts,
): SerializedSurfaceCounts {
  const result: SerializedSurfaceCounts = {}
  for (const [surfaceId, byType] of Object.entries(counts)) {
    const present = Object.fromEntries(
      Object.entries(byType).filter(([, count]) => count > 0),
    )
    if (Object.keys(present).length > 0) result[surfaceId] = present
  }
  return result
}

/** `unitLists` names each ability's synced unit-list params. Reconcile keeps
 *  their entries for absent units hidden; links carry only the entries the
 *  reconciled defaults offer. */
export function serializeAbilities(
  config: Record<string, Record<string, unknown>>,
  reconciledDefaults: Record<string, Record<string, unknown>>,
  unitLists: Readonly<Record<string, readonly string[]>> = {},
): Record<string, Record<string, unknown>> {
  const result: Record<string, Record<string, unknown>> = {}
  for (const [key, params] of Object.entries(config)) {
    const defaults = reconciledDefaults[key]
    if (!defaults) continue
    const diff: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(params)) {
      const value = unitLists[key]?.includes(k)
        ? withoutHiddenEntries(v, defaults[k])
        : v
      if (!isDeepEqual(value, defaults[k])) {
        diff[k] = value
      }
    }
    if (Object.keys(diff).length > 0) {
      result[key] = diff
    }
  }
  return result
}

function entryKey(entry: unknown): unknown {
  return Array.isArray(entry) ? entry[0] : entry
}

function withoutHiddenEntries(value: unknown, defaults: unknown): unknown {
  if (!Array.isArray(value) || !Array.isArray(defaults)) return value
  const offered = new Set(defaults.map(entryKey))
  return value.filter(entry => offered.has(entryKey(entry)))
}
