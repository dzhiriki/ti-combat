import { isDeepEqual } from 'remeda'

import { UNIT_TYPES } from '@/constants/units'
import type {
  GameSystem,
  SurfaceUnitSelections,
  UnitBaseType,
  UnitSelection,
} from '@/types'

export type SerializedUnits = Record<string, [number, 0 | 1]>
export type SerializedSurfaceUnits = Record<string, SerializedUnits>

export interface SerializedConfig {
  v: 1 | 2
  g: GameSystem
  af: string
  df: string
  m: 'S' | 'G'
  au: SerializedUnits
  du: SerializedUnits
  /** v2 surface editor state. Omitted by legacy links. */
  e?: 'S' | 'F'
  p?: string[]
  sp?: string
  asu?: SerializedSurfaceUnits
  dsu?: SerializedSurfaceUnits
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

export function serializeSurfaceUnits(
  placements: SurfaceUnitSelections,
): SerializedSurfaceUnits {
  return Object.fromEntries(
    Object.entries(placements).map(([surfaceId, selections]) => [
      surfaceId,
      serializeUnits(selections),
    ]),
  )
}

export function deserializeSurfaceUnits(
  serialized: SerializedSurfaceUnits | undefined,
  surfaceIds: readonly string[],
): SurfaceUnitSelections {
  const result: SurfaceUnitSelections = {}
  for (const surfaceId of surfaceIds) {
    const selections = Object.fromEntries(
      UNIT_TYPES.map(type => [type, { count: 0, upgraded: false }]),
    ) as Record<UnitBaseType, UnitSelection>
    for (const [type, tuple] of Object.entries(serialized?.[surfaceId] ?? {})) {
      if (!(type in selections)) continue
      selections[type as UnitBaseType] = {
        count: tuple[0],
        upgraded: tuple[1] === 1,
      }
    }
    result[surfaceId] = selections
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
