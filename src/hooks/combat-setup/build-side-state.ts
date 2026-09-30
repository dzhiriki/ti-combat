import type {
  SideAbilitiesConfig,
  SideStateData,
} from '@/combat/combat-state/types'
import type {
  GameSystem,
  SideUnitPlacements,
  SurfaceDefinition,
  UnitIdList,
  UnitStats,
} from '@/types'
import {
  buildUnitStatsMap,
  getSimulationUnitsOnSurfaces,
} from '@/utils/get-simulation-units'

export function buildSideState(
  system: GameSystem,
  faction: string,
  placements: SideUnitPlacements,
  surfaces: readonly SurfaceDefinition[],
  abilities: SideAbilitiesConfig,
  placementStats: Record<string, UnitStats>,
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
    placementStats,
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
