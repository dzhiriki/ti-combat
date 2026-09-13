import type { Ability } from '@/combat'

import type { GameData } from './game-data'
import type { UnitBaseType, UnitDefinition, UnitDefinitionInput } from './unit'

// Game systems the calculator supports. TI4 is the base + expansions
// (Prophecy of Kings, Codices, Thunder's Edge). Twilight's Fall is a
// separate ruleset with its own faction roster and unit set. Each system
// has its own data module: `src/data/main` and `src/data/tf`.
export type GameSystem = 'TI4' | 'TF'

export type FactionAbilities = Record<string, Ability[]>

// Faction data structure
export interface Faction {
  name: string
  icon?: string
  units: Partial<Record<UnitBaseType, UnitDefinition>>
  abilities?: FactionAbilities
}

/** Lazy definitions receive the same GameData entity exported by the system.
 *  While factions are resolving, its `factions` lookup intentionally exposes
 *  only static factions. */
export type Lazy<T> = T | ((gameData: GameData) => T)

/** Authoring shape of a faction module. Resolved to `Faction` by the system
 *  index; nothing outside `src/data` sees it. */
export interface FactionDefinition {
  name: string
  icon?: string
  units: Partial<Record<UnitBaseType, UnitDefinitionInput>>
  abilities?: Lazy<FactionAbilities>
}
