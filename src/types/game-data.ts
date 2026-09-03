import type { RegisteredAbility } from '@/combat'

import type { Faction } from './faction'

// The shape every game system's data module (`src/data/main`, `src/data/tf`)
// exports: its faction roster, its generic unit roster, and the shared
// (non-faction) ability pool already tagged with panel slots. Consumers pick
// the module for the selected system via `getGameData` and never reach into
// the data folders directly.
export interface GameData {
  factions: Readonly<Record<string, Faction>>
  baseUnits: Readonly<Record<string, unknown>>
  abilities: readonly RegisteredAbility[]
}
