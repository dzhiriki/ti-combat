import { UNIT_LIMITS } from '@/constants/units'
import type { UnitBaseType, UnitLocator, SurfaceId } from '@/types'

import type { SideStateData } from '../combat-state/types'
import { parseUnitLocator } from '../utils/parse-unit-locator'

export type ParamLimit = 'UNIT_LIMIT' | 'IN_COMBAT' | 'EXTRA'

/** Count units on `s` whose variant key shares `baseType`. Walks both
 *  participating and non-participating ids. Subtypes (e.g. CRUISER:Cavalry)
 *  pool under their base. */
export function countUnitsByBaseType(
  s: SideStateData,
  baseType: UnitBaseType,
  surfaceId?: SurfaceId,
): number {
  let n = 0
  for (const id of s.participatingUnits) {
    const key = s.unitType[id]
    if (!key || (surfaceId !== undefined && s.unitSurface[id] !== surfaceId))
      continue
    if (parseUnitLocator(key).baseType === baseType) n += 1
  }
  for (const id of s.nonParticipatingUnits) {
    const key = s.unitType[id]
    if (!key || (surfaceId !== undefined && s.unitSurface[id] !== surfaceId))
      continue
    if (parseUnitLocator(key).baseType === baseType) n += 1
  }
  return n
}

/** Per-variant cap used by both `getUnitVariantsOptions` (UI input max) and
 *  reconcile (stored-value clamp). Always returns a non-negative integer. */
export function resolveVariantLimit(
  limit: ParamLimit,
  s: SideStateData,
  variantKey: UnitLocator,
): number {
  const { baseType: base, surfaceId } = parseUnitLocator(variantKey)
  if (limit === 'UNIT_LIMIT') return UNIT_LIMITS[base]
  const inCombat = countUnitsByBaseType(
    s,
    base,
    limit === 'IN_COMBAT' ? surfaceId : undefined,
  )
  if (limit === 'IN_COMBAT') return inCombat
  // EXTRA: reinforcement headroom — how many more units of this base type
  // could still be added without breaching UNIT_LIMITS.
  return Math.max(0, UNIT_LIMITS[base] - inCombat)
}
