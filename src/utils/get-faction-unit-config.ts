import type { GameSystem, UnitBaseType, UnitDefinition } from '@/types'

import { getGameData } from './get-game-data'

/** Returns the selected system's merged base and faction unit definitions. */
export function getFactionUnitConfig(
  system: GameSystem,
  factionKey: string,
): Record<UnitBaseType, UnitDefinition> {
  return getGameData(system).getFactionUnitConfig(factionKey)
}
