import { UNIT_TYPES } from '@/constants/units'
import {
  type GameSystem,
  type UnitBaseType,
  type UnitDefinition,
} from '@/types'

import { getFaction } from './get-faction'
import { getGameData } from './get-game-data'

/**
 * Returns merged unit definitions for a faction.
 * Structure is identical to base_units.json: Record<UnitBaseType, UnitDefinition>
 * Faction-specific units override the generic roster of the faction's system.
 */
export function getFactionUnitConfig(
  system: GameSystem,
  factionKey: string,
): Record<UnitBaseType, UnitDefinition> {
  const factionUnits = getFaction(system, factionKey).units
  const roster = getGameData(system).baseUnits
  const result = {} as Record<UnitBaseType, UnitDefinition>

  for (const unitType of UNIT_TYPES) {
    const baseUnit = roster[unitType] as UnitDefinition
    const factionUnit = factionUnits[unitType]

    // Faction unit takes precedence, otherwise use base unit
    // Default to { BASE: null } if neither exists
    result[unitType] = factionUnit ?? baseUnit ?? { BASE: null }
  }

  return result
}
