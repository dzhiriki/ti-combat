import * as main from '@/data/main'
import type { FactionKey, GameSystem } from '@/types'

import { getGameData } from './get-game-data'

export const GAME_SYSTEMS: readonly GameSystem[] = ['TI4', 'TWILIGHTS_FALL']

export const GAME_SYSTEM_LABELS: Record<GameSystem, string> = {
  TI4: 'Twilight Imperium',
  TWILIGHTS_FALL: "Twilight's Fall",
}

/** The game system a faction belongs to — the data module that defines it.
 *  Neutral exists in every system and resolves to TI4. */
export function getFactionSystem(factionKey: FactionKey): GameSystem {
  return factionKey in main.factions ? 'TI4' : 'TWILIGHTS_FALL'
}

/** Faction keys offered in a given system, in registry order. */
export function getFactionKeysBySystem(system: GameSystem): FactionKey[] {
  return Object.keys(getGameData(system).factions) as FactionKey[]
}

/** Default faction to select when switching to a system — the first one
 *  declared in that system's registry order. */
export const DEFAULT_FACTION_BY_SYSTEM: Record<GameSystem, FactionKey> =
  GAME_SYSTEMS.reduce(
    (acc, system) => {
      acc[system] = getFactionKeysBySystem(system)[0]
      return acc
    },
    {} as Record<GameSystem, FactionKey>,
  )
