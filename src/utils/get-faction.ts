import type { Faction, FactionKey } from '@/types'

import { getFactionSystem } from './get-faction-system'
import { getGameData } from './get-game-data'

/** A faction's definition, looked up in the data module of its own system. */
export function getFaction(factionKey: FactionKey): Faction {
  return getGameData(getFactionSystem(factionKey)).factions[factionKey]
}
