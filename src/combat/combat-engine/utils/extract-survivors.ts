import type { SurfaceDefinition, UnitIdList } from '@/types'

import type { SideStateData } from '../../combat-state/types'
import type { SurfaceSurvivors, SurvivorSide } from '../../types'
import { parseUnitLocator } from '../../utils/parse-unit-locator'

/**
 * Extract survivors from compact state. Includes both participating and
 * non-participating units — an alive non-participating ship after ground
 * combat is still a survivor. Called once per unique outcome (not per
 * leaf) for lazy extraction.
 */
export function extractSurvivors(
  sideState: SideStateData,
  surfaces: readonly SurfaceDefinition[],
): { aggregate: SurvivorSide; bySurface: SurfaceSurvivors } {
  const survivors: SurvivorSide = {}
  const bySurface: SurfaceSurvivors = Object.fromEntries(
    surfaces.map(surface => [surface.id, {}]),
  )

  const collect = (pool: UnitIdList) => {
    for (const id of pool) {
      const key = sideState.unitType[id]
      if (!key) continue

      const { baseType: type, subtypes } = parseUnitLocator(key)

      if (!survivors[type]) {
        survivors[type] = []
      }

      const us = sideState.unitState[id]
      const unit = {
        isDamaged: us?.isDamaged,
        subtypes: subtypes.length ? subtypes : undefined,
      }
      survivors[type]!.push(unit)
      const surfaceId = sideState.unitSurface[id]
      if (surfaceId !== undefined) {
        const scoped = bySurface[surfaceId] ?? (bySurface[surfaceId] = {})
        ;(scoped[type] ??= []).push(unit)
      }
    }
  }
  collect(sideState.participatingUnits)
  collect(sideState.nonParticipatingUnits)

  return { aggregate: survivors, bySurface }
}
