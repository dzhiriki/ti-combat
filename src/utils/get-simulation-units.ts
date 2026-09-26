import { nextUnitIds } from '@/combat'
import { DEFAULT_UNIT_SURFACES, UNIT_TYPES } from '@/constants/units'
import type {
  GameSystem,
  SurfaceDefinition,
  SurfaceId,
  SurfaceUnitCounts,
  UnitBaseType,
  UnitIdList,
  UnitStats,
  UnitType,
} from '@/types'

import { getFactionUnitConfig } from './get-faction-unit-config'

/** Builds unit instances from surface placements. `units` is a packed
 *  UnitIdList — the caller places it into `participatingUnits` and lets
 *  `CombatState.forSimulation` split out the non-participating tail. The
 *  shared `gen` carries the post-allocation counter so the caller can store
 *  it on the parent CombatStateData for runtime placements. */
export function getSimulationUnitsOnSurfaces(
  counts: SurfaceUnitCounts,
  surfaces: readonly SurfaceDefinition[],
  gen: { _nextCode?: number },
  placementStats: Partial<Record<UnitBaseType, UnitStats>>,
): {
  units: UnitIdList
  unitType: Record<string, UnitType>
  unitSurface: Record<string, SurfaceId>
} {
  const surfacesById = new Map(surfaces.map(surface => [surface.id, surface]))
  let units = ''
  const unitType: Record<string, UnitType> = {}
  const unitSurface: Record<string, SurfaceId> = {}

  for (const [surfaceKey, byType] of Object.entries(counts)) {
    const surface = surfacesById.get(surfaceKey as SurfaceId)
    if (!surface) throw new Error(`Unknown surface: ${surfaceKey}`)

    for (const baseType of UNIT_TYPES) {
      const count = byType[baseType]
      if (!count || count <= 0) continue

      const stats = placementStats[baseType]
      if (!stats) continue
      const allowed = stats.ALLOWED_SURFACES ?? DEFAULT_UNIT_SURFACES[baseType]
      if (!allowed.includes(surface.type)) {
        throw new Error(`${baseType} cannot be placed on ${surface.type}`)
      }

      for (const id of nextUnitIds(count, gen)) {
        units += id
        unitType[id] = baseType as UnitType
        unitSurface[id] = surface.id
      }
    }
  }

  return { units: units as UnitIdList, unitType, unitSurface }
}

/**
 * Builds a map of original unit stats templates for all unit types
 * that have valid definitions. Used by placeUnits to initialize new units
 * with correct (unmodified) stats.
 */
export function buildUnitStatsMap(
  system: GameSystem,
  faction: string,
  upgrades?: ReadonlySet<UnitBaseType>,
): Record<string, UnitStats> {
  const factionConfig = getFactionUnitConfig(system, faction)
  const result: Record<string, UnitStats> = {}

  for (const unitType of UNIT_TYPES) {
    const unitDef = factionConfig[unitType]
    if (!unitDef?.BASE) continue
    result[unitType] = getEffectiveStats(
      unitDef.BASE,
      unitDef.UPGRADED,
      upgrades?.has(unitType) ?? false,
    )
  }

  return result
}

/**
 * Merges BASE and UPGRADED stats based on upgrade status.
 * Returns null if no valid stats exist.
 */
export function getEffectiveStats(
  baseStats: UnitStats,
  upgradedStats: Partial<UnitStats> | undefined,
  isUpgraded: boolean,
): UnitStats {
  if (isUpgraded && upgradedStats) {
    return {
      ...baseStats,
      ...upgradedStats,
      UNIT_ABILITIES: {
        ...baseStats?.UNIT_ABILITIES,
        ...upgradedStats.UNIT_ABILITIES,
      },
    }
  }

  return { ...baseStats }
}
