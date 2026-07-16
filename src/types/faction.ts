import type { Ability } from '@/combat'
import factions from '@/data/faction'

import type { UnitBaseType, UnitDefinition } from './unit'

// Game systems the calculator supports. TI4 is the base + expansions
// (Prophecy of Kings, Codices, Thunder's Edge). Twilight's Fall is a
// separate ruleset with its own faction roster and unit set.
export type GameSystem = 'TI4' | 'TWILIGHTS_FALL'

interface FactionAbilities {
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
  // The game system this faction belongs to. Defaults to 'TI4' when omitted,
  // so existing factions don't need to declare it.
  system?: GameSystem
  units: Partial<Record<UnitBaseType, UnitDefinition>>
  abilities?: FactionAbilities
}

// All faction keys
export type FactionKey = keyof typeof factions
