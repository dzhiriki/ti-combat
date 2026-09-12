import { nextUnitIds } from '@/combat'
import { UNIT_TYPES } from '@/constants/units'
import type {
  FactionKey,
  GameSystem,
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
  faction: FactionKey,
  selections: Record<UnitBaseType, UnitSelection>,
  gen: { _nextCode?: number },
): {
  units: UnitIdList
  unitType: Record<string, UnitType>
  unitState: Record<string, UnitState>
  unitStats: Record<string, UnitStats>
} {
  const factionConfig = getFactionUnitConfig(system, faction)
  let units = ''
  const unitType: Record<string, UnitType> = {}
  const unitState: Record<string, UnitState> = {}
  const unitStats: Record<string, UnitStats> = {}

  for (const baseType of UNIT_TYPES) {
    const sel = selections[baseType]
    if (sel.count === 0) continue

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

    const ids = nextUnitIds(sel.count, gen)
    for (const id of ids) {
      units += id
      unitType[id] = baseType as UnitType
    }
    unitStats[baseType] = effectiveStats
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
  }
}

/**
 * Builds a map of original unit stats templates for all unit types
 * that have valid definitions. Used by placeUnits to initialize new units
 * with correct (unmodified) stats.
 */
export function buildUnitStatsMap(
  system: GameSystem,
  faction: FactionKey,
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
