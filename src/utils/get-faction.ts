import type { Faction, GameSystem } from '@/types'

import { getGameData } from './get-game-data'

/** Look up a faction in the selected system, rejecting cross-system input. */
export function getFaction(system: GameSystem, factionKey: string): Faction {
  return getGameData(system).getFaction(factionKey)
}
