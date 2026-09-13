import type { Ability, RegisteredAbility } from '@/combat'

import type { CombatSide } from './combat-side'
import type { Faction, GameSystem } from './faction'
import type { UnitBaseType, UnitDefinition } from './unit'

// The complete public entry point exported by every game system. Consumers
// select one through `getGameData` and do not import system internals.
export interface SlotDisplay {
  category: string
  subcategory?: string
}

export interface AbilitySlotData {
  FACTION_KEY_TO_SLOT: Readonly<Record<string, string>>
  unitSlot(baseType: UnitBaseType): string
}

export interface GameData extends AbilitySlotData {
  id: GameSystem
  label: string
  defaultFaction: string
  factions: Readonly<Record<string, Faction>>
  baseUnits: Readonly<Record<string, UnitDefinition>>
  /** Full system pool before faction- and side-specific entries are added. */
  abilities: readonly RegisteredAbility[]
  /** Every ability reachable through this system, for config validation. */
  allAbilities: readonly Ability[]
  SLOT_DISPLAY: Readonly<Record<string, SlotDisplay>>
  SLOT_ORDER: readonly string[]
  /** All shared, faction, and unit abilities registered under a slot. */
  getAbilities(slot: string): readonly Ability[]
  getFaction(factionKey: string): Faction
  getFactionUnitConfig(factionKey: string): Record<UnitBaseType, UnitDefinition>
  getAvailableAbilities(
    side: CombatSide,
    factionKey: string,
    upgradedTypes?: ReadonlySet<UnitBaseType>,
  ): RegisteredAbility[]
  getUnitDefinitionAbilityKeys(factionKey: string): ReadonlySet<string>
  getFactionOwnedAbilityKeys(factionKey: string): ReadonlySet<string>
}
