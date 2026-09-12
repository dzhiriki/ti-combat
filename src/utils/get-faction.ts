import type { Faction, GameSystem } from '@/types'

import { getGameData } from './get-game-data'

/** Look up a faction in the selected system, rejecting cross-system input. */
export function getFaction(system: GameSystem, factionKey: string): Faction {
  const factions = getGameData(system).factions
  if (!Object.hasOwn(factions, factionKey)) {
    throw new Error(`Faction "${factionKey}" is not available in ${system}`)
  }
  return factions[factionKey]
}
