import factions from '@/data/faction'
import type { FactionKey, GameSystem } from '@/types'

export const GAME_SYSTEMS: readonly GameSystem[] = ['TI4', 'TWILIGHTS_FALL']

export const GAME_SYSTEM_LABELS: Record<GameSystem, string> = {
  TI4: 'Twilight Imperium',
  TWILIGHTS_FALL: "Twilight's Fall",
}

/** The game system a faction belongs to. Factions omit `system` to mean TI4. */
export function getFactionSystem(factionKey: FactionKey): GameSystem {
  return factions[factionKey]?.system ?? 'TI4'
}

/** Faction keys belonging to a given system, in registry order. */
export function getFactionKeysBySystem(system: GameSystem): FactionKey[] {
  return (Object.keys(factions) as FactionKey[]).filter(
    key => getFactionSystem(key) === system,
  )
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
