import { nextUnitIds } from '@/combat'
import { DEFAULT_UNIT_SURFACES, UNIT_TYPES } from '@/constants/units'
import type {
  GameSystem,
  SurfaceDefinition,
  SurfaceId,
  SurfaceUnitSelections,
  UnitBaseType,
  UnitIdList,
  UnitSelection,
  UnitState,
  UnitStats,
  UnitType,
} from '@/types'

import { getFactionUnitConfig } from './get-faction-unit-config'

/**
 * Converts faction + unit selections into compact unit data for combat simulation.
 * Returns a packed UnitIdList and stats maps keyed by variant key (base type only at creation).
 */
export function getSimulationUnits(
  system: GameSystem,
  faction: string,
  selections: Record<UnitBaseType, UnitSelection>,
  gen: { _nextCode?: number },
): {
  units: UnitIdList
  unitType: Record<string, UnitType>
  unitState: Record<string, UnitState>
  unitStats: Record<string, UnitStats>
  surfaceUnits: Record<string, UnitIdList>
  unitSurface: Record<string, SurfaceId>
} {
  return getSimulationUnitsOnSurfaces(
    system,
    faction,
    { space: selections },
    [{ id: 'space' as SurfaceId, type: 'SPACE', name: 'Space' }],
    gen,
  )
}

/** Builds unit instances from the engine's explicit surface representation. */
export function getSimulationUnitsOnSurfaces(
  system: GameSystem,
  faction: string,
  placements: SurfaceUnitSelections,
  surfaces: readonly SurfaceDefinition[],
  gen: { _nextCode?: number },
): {
  units: UnitIdList
  unitType: Record<string, UnitType>
  unitState: Record<string, UnitState>
  unitStats: Record<string, UnitStats>
  surfaceUnits: Record<string, UnitIdList>
  unitSurface: Record<string, SurfaceId>
} {
  const factionConfig = getFactionUnitConfig(system, faction)
  let units = ''
  const unitType: Record<string, UnitType> = {}
  const unitState: Record<string, UnitState> = {}
  const unitStats: Record<string, UnitStats> = {}
  const surfaceUnits: Record<string, UnitIdList> = {}
  const unitSurface: Record<string, SurfaceId> = {}

  for (const [surfaceKey, selections] of Object.entries(placements)) {
    const surface = surfaces.find(candidate => candidate.id === surfaceKey)
    if (!surface) throw new Error(`Unknown surface: ${surfaceKey}`)
    let surfaceList = ''
    for (const baseType of UNIT_TYPES) {
      const sel = selections[baseType]
      if (!sel || sel.count === 0) continue

      const unitDef = factionConfig[baseType]
      const baseStats = unitDef.BASE
      const upgradedStats = unitDef.UPGRADED

      if (!baseStats && !upgradedStats) continue

      const effectiveStats = getEffectiveStats(
        baseStats,
        upgradedStats,
        sel.upgraded,
      )
      if (!effectiveStats) continue
      const allowed =
        effectiveStats.ALLOWED_SURFACES ?? DEFAULT_UNIT_SURFACES[baseType]
      if (!allowed.includes(surface.type)) {
        throw new Error(`${baseType} cannot be placed on ${surface.type}`)
      }

      const ids = nextUnitIds(sel.count, gen)
      for (const id of ids) {
        units += id
        surfaceList += id
        unitType[id] = baseType as UnitType
        unitSurface[id] = surfaceKey as SurfaceId
      }
      unitStats[baseType] = effectiveStats
    }
    surfaceUnits[surfaceKey] = surfaceList as UnitIdList
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
    surfaceUnits,
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
