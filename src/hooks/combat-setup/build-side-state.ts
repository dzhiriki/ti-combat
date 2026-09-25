import type {
  RegisteredAbility,
  DeclaredSubtype,
  UnitCategoryOptions,
} from '@/combat/abilities-engine/types'
import type {
  SideAbilitiesConfig,
  SideStateData,
  UnitStatsEntry,
} from '@/combat/combat-state/types'
import { makeVariantId } from '@/combat/utils/unit-variant'
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
  declaredSubtypes: readonly DeclaredSubtype[] = [],
  unitCategoryOptions?: UnitCategoryOptions,
): SideStateData {
  const upgradedSet = new Set(placements.upgradedTypes)
  const nativeStats = buildUnitStatsMap(system, faction, upgradedSet)
  const placementStats = applyAbilityPlacementOverrides(
    nativeStats,
    registeredAbilities,
    abilities,
  )
  const { units, unitType, unitState, unitStats, unitSurface } =
    getSimulationUnitsOnSurfaces(
      system,
      faction,
      placements,
      surfaces,
      gen,
      placementStats,
      nativeStats,
    )

  const baseUnitStats: Record<string, UnitStatsEntry> = {
    ...nativeStats,
    ...unitStats,
  }

  // Register variant-key entries from declared subtypes as factory functions
  // so `resolveUnitStats` re-evaluates them lazily against the *current*
  // parent stats. Eager evaluation here would freeze the variant before
  // runtime mutators like Reveal Prototype's `modifyUnitType` upgrade the
  // base — Viscount on an upgraded Cruiser must reflect the upgrade.
  for (const decl of declaredSubtypes) {
    const variantKey = makeVariantId(decl.unitType, [decl.name])
    if (baseUnitStats[variantKey]) continue
    baseUnitStats[variantKey] = decl.statsFactory
  }

  return {
    faction,
    participatingUnits: units,
    nonParticipatingUnits: '' as UnitIdList,

    unitSurface,
    unitType,
    unitState,
    unitStats: baseUnitStats,
    declaredSubtypes,
    unitCategoryOptions,
    abilities,
    liveAbilities: {},
  }
}
