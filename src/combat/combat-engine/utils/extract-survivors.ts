import type { UnitIdList } from '@/types'

import type { SideStateData } from '../../combat-state/types'
import type { SurfaceSurvivors, SurvivorSide } from '../../types'
import { parseVariantId } from '../../utils/unit-variant'

/**
 * Extract survivors from compact state. Includes both participating and
 * non-participating units — an alive non-participating ship after ground
 * combat is still a survivor. Called once per unique outcome (not per
 * leaf) for lazy extraction.
 */
export function extractSurvivors(sideState: SideStateData): SurvivorSide {
  const survivors: SurvivorSide = {}

  const collect = (pool: UnitIdList) => {
    for (const id of pool) {
      const key = sideState.unitType[id]
      if (!key) continue

      const { type, subtypes } = parseVariantId(key)

      if (!survivors[type]) {
        survivors[type] = []
      }

      const us = sideState.unitState[id]
      survivors[type]!.push({
        isDamaged: us?.isDamaged,
        subtypes: subtypes.length ? subtypes : undefined,
      })
    }
  }
  collect(sideState.participatingUnits)
  collect(sideState.nonParticipatingUnits)

  return survivors
}

/** Extract survivors without losing their physical location. Surface keys
 *  are retained even when no units survive there so callers can render the
 *  system hierarchy consistently. */
export function extractSurvivorsBySurface(
  sideState: SideStateData,
): SurfaceSurvivors {
  const result: SurfaceSurvivors = {}

  for (const [surfaceId, unitIds] of Object.entries(sideState.surfaceUnits)) {
    const survivors: SurvivorSide = {}
    for (const id of unitIds) {
      const key = sideState.unitType[id]
      if (!key) continue
      const { type, subtypes } = parseVariantId(key)
      const units = survivors[type] ?? (survivors[type] = [])
      const state = sideState.unitState[id]
      units.push({
        isDamaged: state?.isDamaged,
        subtypes: subtypes.length ? subtypes : undefined,
      })
    }
    result[surfaceId] = survivors
  }

  return result
}
