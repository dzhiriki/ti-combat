import type { Ability } from '@/combat'
import type { factions as mainFactions } from '@/data/main'
import type { factions as tfFactions } from '@/data/tf'

import type { UnitBaseType, UnitDefinition } from './unit'

// Game systems the calculator supports. TI4 is the base + expansions
// (Prophecy of Kings, Codices, Thunder's Edge). Twilight's Fall is a
// separate ruleset with its own faction roster and unit set. Each system
// has its own data module: `src/data/main` and `src/data/tf`.
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
  units: Partial<Record<UnitBaseType, UnitDefinition>>
  abilities?: FactionAbilities
}

// All faction keys across every game system. A faction's system is the data
// module it lives in — see `getFactionSystem`.
export type FactionKey = keyof typeof mainFactions | keyof typeof tfFactions
