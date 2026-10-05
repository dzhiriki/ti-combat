import type { Faction } from '@/types'
import { GAME_SYSTEMS, getGameData } from '@/utils/get-game-data'

/**
 * The faction behind a key in whichever game system defines it. Keys are
 * unique across systems apart from NEUTRAL, which every system carries.
 */
export function findFaction(key: string): Faction | undefined {
  for (const system of GAME_SYSTEMS) {
    const faction = getGameData(system).factions[key]
    if (faction) return faction
  }
  return undefined
}
