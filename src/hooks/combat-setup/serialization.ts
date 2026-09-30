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

export function serializeAbilities(
  config: Record<string, Record<string, unknown>>,
  reconciledDefaults: Record<string, Record<string, unknown>>,
): Record<string, Record<string, unknown>> {
  const result: Record<string, Record<string, unknown>> = {}
  for (const [key, params] of Object.entries(config)) {
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
