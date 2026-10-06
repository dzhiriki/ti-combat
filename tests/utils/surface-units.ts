import { CombatSideState } from '@/combat/combat-side-state/combat-side-state'
import type { SideStateData } from '@/combat/combat-state/types'
import {
  SPACE_SURFACE_ID,
  type SurfaceDefinition,
  type SurfaceId,
} from '@/types'

export const PLANET_1 = 'planet-1' as SurfaceId
export const PLANET_2 = 'planet-2' as SurfaceId

/** Config for a ground combat over two planets, fought in order. */
export const TWO_PLANET_INVASION = {
  mode: 'GROUND',
  surfaces: [
    { id: SPACE_SURFACE_ID, type: 'SPACE', name: 'Space' },
    { id: PLANET_1, type: 'PLANET', name: 'Planet 1' },
    { id: PLANET_2, type: 'PLANET', name: 'Planet 2' },
  ] as SurfaceDefinition[],
  invasionPlanets: [PLANET_1, PLANET_2],
} as const

/** Inspect living units at a location without relying on an engine index. */
export function getSurfaceUnitIds(side: SideStateData, surfaceId: SurfaceId) {
  return CombatSideState.getUnits(side, undefined, {
    surfaceId,
    includeVariants: false,
  })
}
