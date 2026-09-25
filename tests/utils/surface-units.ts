import { CombatSideState } from '@/combat/combat-side-state/combat-side-state'
import type { SideStateData } from '@/combat/combat-state/types'
import type { SurfaceId } from '@/types'

/** Inspect living units at a location without relying on an engine index. */
export function getSurfaceUnitIds(side: SideStateData, surfaceId: SurfaceId) {
  return CombatSideState.getUnits(side, undefined, {
    surfaceId,
    includeVariants: false,
  })
}
