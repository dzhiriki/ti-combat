import * as main from '@/data/main'
import type { GameSystem } from '@/types'

import { getGameData } from './get-game-data'

export const GAME_SYSTEMS: readonly GameSystem[] = ['TI4', 'TF']

export const GAME_SYSTEM_LABELS: Record<GameSystem, string> = {
  TI4: 'Twilight Imperium',
  TF: "Twilight's Fall",
}

/** The game system a faction belongs to — the data module that defines it.
 *  Neutral exists in every system and resolves to TI4. */
export function getFactionSystem(factionKey: string): GameSystem {
  if (Object.hasOwn(main.factions, factionKey)) return 'TI4'
  if (Object.hasOwn(getGameData('TF').factions, factionKey)) return 'TF'
  throw new Error(`Unknown faction "${factionKey}"`)
}

/** Faction keys offered in a given system, in registry order. */
export function getFactionKeysBySystem(system: GameSystem): string[] {
  return Object.keys(getGameData(system).factions)
}

/** Default faction to select when switching to a system — the first one
 *  declared in that system's registry order. */
export const DEFAULT_FACTION_BY_SYSTEM: Record<GameSystem, string> =
  GAME_SYSTEMS.reduce(
    (acc, system) => {
      acc[system] = getFactionKeysBySystem(system)[0]
      return acc
    },
    {} as Record<GameSystem, string>,
  )
