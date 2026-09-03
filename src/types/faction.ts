import type { Ability, AbilitySlot } from '@/combat'
import type { factions as mainFactions } from '@/data/main'
import type { factions as tfFactions } from '@/data/tf'

import type { UnitBaseType, UnitDefinition, UnitDefinitionInput } from './unit'

// Game systems the calculator supports. TI4 is the base + expansions
// (Prophecy of Kings, Codices, Thunder's Edge). Twilight's Fall is a
// separate ruleset with its own faction roster and unit set. Each system
// has its own data module: `src/data/main` and `src/data/tf`.
export type GameSystem = 'TI4' | 'TWILIGHTS_FALL'

export interface FactionAbilities {
  faction?: readonly Ability[]
  technology?: readonly Ability[]
  unit?: readonly Ability[]
  promissory?: readonly Ability[]
  agent?: readonly Ability[]
  commander?: readonly Ability[]
  hero?: readonly Ability[]
  breakthrough?: readonly Ability[]
}

// Faction data structure
export interface Faction {
  name: string
  icon?: string
  units: Partial<Record<UnitBaseType, UnitDefinition>>
  abilities?: FactionAbilities
}

/** Registration-time view of a game system, handed to lazy faction
 *  definitions. Lazy factions are not visible in `factions`. */
export interface DataRegistry {
  readonly system: GameSystem
  readonly baseUnits: Readonly<Record<string, UnitDefinition>>
  readonly factions: Readonly<Record<string, Faction>>
  /** Every ability registered under `slot`: shared decks from the system's
   *  `abilities` list, faction-owned lists via FACTION_KEY_TO_SLOT, and
   *  unit-attached abilities via `unitSlot`. Computed once per slot. */
  getAbilities(slot: AbilitySlot): readonly Ability[]
}

export type Lazy<T> = T | ((registry: DataRegistry) => T)

/** Authoring shape of a faction module. Resolved to `Faction` by the system
 *  index; nothing outside `src/data` sees it. */
export interface FactionDefinition {
  name: string
  icon?: string
  units: Partial<Record<UnitBaseType, UnitDefinitionInput>>
  abilities?: Lazy<FactionAbilities>
}

// All faction keys across every game system. A faction's system is the data
// module it lives in — see `getFactionSystem`.
export type FactionKey = keyof typeof mainFactions | keyof typeof tfFactions
