import type { RegisteredAbility } from '@/combat/abilities-engine/types'
import type {
  SideAbilitiesConfig,
  SideStateData,
} from '@/combat/combat-state/types'
import type {
  GameSystem,
  SideUnitPlacements,
  SurfaceDefinition,
  UnitIdList,
} from '@/types'
import {
  buildUnitStatsMap,
  getSimulationUnitsOnSurfaces,
} from '@/utils/get-simulation-units'

import { applyAbilityPlacementOverrides } from './ability-placement'

export function buildSideState(
  system: GameSystem,
  faction: string,
  placements: SideUnitPlacements,
  surfaces: readonly SurfaceDefinition[],
  abilities: SideAbilitiesConfig,
  registeredAbilities: readonly RegisteredAbility[],
  gen: { _nextCode?: number },
): SideStateData {
  const unitStats = buildUnitStatsMap(
    system,
    faction,
    new Set(placements.upgradedTypes),
  )
  const { units, unitType, unitSurface } = getSimulationUnitsOnSurfaces(
    placements.counts,
    surfaces,
    gen,
    applyAbilityPlacementOverrides(unitStats, registeredAbilities, abilities),
  )

  return {
    faction,
    participatingUnits: units,
    nonParticipatingUnits: '' as UnitIdList,
    unitSurface,
    unitType,
    unitState: {},
    unitStats: unitStats as SideStateData['unitStats'],
    abilities,
    liveAbilities: {},
  }
}
