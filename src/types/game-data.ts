import type { RegisteredAbility } from '@/combat'

import type { Faction } from './faction'
import type { UnitBaseType } from './unit'

// The shape every game system's data module (`src/data/main`, `src/data/tf`)
// exports: its faction roster, its generic unit roster, and the shared
// (non-faction) ability pool already tagged with panel slots. Consumers pick
// the module for the selected system via `getGameData` and never reach into
// the data folders directly.
export interface SlotDisplay {
  category: string
  subcategory?: string
}

export interface AbilitySlotData {
  FACTION_KEY_TO_SLOT: Readonly<Record<string, string>>
  unitSlot(baseType: UnitBaseType): string
}

export interface GameData extends AbilitySlotData {
  factions: Readonly<Record<string, Faction>>
  baseUnits: Readonly<Record<string, unknown>>
  abilities: readonly RegisteredAbility[]
  SLOT_DISPLAY: Readonly<Record<string, SlotDisplay>>
  SLOT_ORDER: readonly string[]
}
