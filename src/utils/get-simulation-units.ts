import { nextUnitIds } from '@/combat'
import { DEFAULT_UNIT_SURFACES, UNIT_TYPES } from '@/constants/units'
import type {
  GameSystem,
  SurfaceDefinition,
  SurfaceId,
  SideUnitPlacements,
  UnitBaseType,
  UnitIdList,
  UnitState,
  UnitStats,
  UnitType,
} from '@/types'

import { getFactionUnitConfig } from './get-faction-unit-config'

/** Builds unit instances from the engine's explicit surface representation. */
export function getSimulationUnitsOnSurfaces(
  system: GameSystem,
  faction: string,
  placements: SideUnitPlacements,
  surfaces: readonly SurfaceDefinition[],
  gen: { _nextCode?: number },
  placementStats?: Partial<Record<UnitBaseType, UnitStats>>,
  nativeStats = buildUnitStatsMap(
    system,
    faction,
    new Set(placements.upgradedTypes),
  ),
): {
  units: UnitIdList
  unitType: Record<string, UnitType>
  unitState: Record<string, UnitState>
  unitStats: Record<string, UnitStats>
  unitSurface: Record<string, SurfaceId>
} {
  const surfacesById = new Map(surfaces.map(surface => [surface.id, surface]))
  let units = ''
  const unitType: Record<string, UnitType> = {}
  const unitState: Record<string, UnitState> = {}
  const unitStats: Record<string, UnitStats> = {}
  const unitSurface: Record<string, SurfaceId> = {}

  for (const [surfaceKey, counts] of Object.entries(placements.counts)) {
    const surface = surfacesById.get(surfaceKey as SurfaceId)
    if (!surface) throw new Error(`Unknown surface: ${surfaceKey}`)

    for (const baseType of UNIT_TYPES) {
      const count = counts[baseType]
      if (!count || count <= 0) continue

      const stats = nativeStats[baseType]
      if (!stats) continue
      const allowed =
        placementStats?.[baseType]?.ALLOWED_SURFACES ??
        stats.ALLOWED_SURFACES ??
        DEFAULT_UNIT_SURFACES[baseType]
      if (!allowed.includes(surface.type)) {
        throw new Error(`${baseType} cannot be placed on ${surface.type}`)
      }

      const ids = nextUnitIds(count, gen)
      for (const id of ids) {
        units += id
        unitType[id] = baseType as UnitType
        unitSurface[id] = surface.id
      }
      unitStats[baseType] = stats
    }
  }

  // Returns a packed UnitIdList — the caller places it into
  // `participatingUnits` and lets `sortUnitsAtSetup` split out the
  // non-participating tail. The shared `gen` carries the
  // post-allocation counter so the caller can store it on the parent
  // CombatStateData for runtime placements.
  return {
    units: units as UnitIdList,
    unitType,
    unitState,
    unitStats,
    unitSurface,
  }
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
