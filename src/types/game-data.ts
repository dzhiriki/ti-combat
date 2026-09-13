import type { RegisteredAbility } from '@/combat'

import type { CombatSide } from './combat-side'
import type { Faction, GameSystem } from './faction'
import type { UnitBaseType, UnitDefinition } from './unit'

// The complete public entry point exported by every game system. Consumers
// select one through `getGameData` and do not import system internals.

/**
 * Where a slot's abilities come from:
 * - `OWN` — the selected faction's own `FACTION_<KEY>` ability group.
 * - `ALL` — the matching group collected from every faction in the system.
 * - `OTHER` — other factions' abilities that reach across the table.
 *
 * Slots with no strategy hold the system's shared decks, registered by its
 * `index.ts` ability arrays.
 */
export type SlotStrategy = 'OWN' | 'ALL' | 'OTHER'

/** Flags an entry or a whole category can set; an item overrides its category. */
interface SlotOptions {
  /** Whether the NEUTRAL faction sees these abilities. Default true. */
  neutral?: boolean
  /**
   * Whether cards show their faction icon. Default true; turn off where the
   * header already names the faction (own agents under FACTION).
   */
  icon?: boolean
}

/** One rendered group of abilities, fed by one slot or by several. */
export interface SlotConfig extends SlotOptions {
  title: string
  slot: string | readonly string[]
  strategy?: SlotStrategy
}

/** Several slots rendered as sub-headers under one title (e.g. FACTION). */
export interface SlotCategory extends SlotOptions {
  title: string
  items: readonly SlotConfig[]
}

/**
 * A system's complete ability layout, in render order: slot titles, sourcing
 * strategies, and the grouping of slots into categories.
 */
export type SlotEntry = SlotConfig | SlotCategory

/** The slot names a slot config declares — a system's `AbilitySlot` union. */
export type SlotNames<Entry> = Entry extends { items: readonly (infer Item)[] }
  ? SlotNames<Item>
  : Entry extends { slot: infer Slot }
    ? Slot extends readonly (infer Name)[]
      ? Name
      : Slot
    : never

/**
 * A registered ability with ownership and deployment metadata. Eligibility
 * and presentation are defined by the system's slot config.
 */
export interface CollectedAbility extends RegisteredAbility {
  /** Owning faction; absent for the system's shared decks. */
  factionKey?: string
  /** A unit's DEPLOY comes in base and upgraded variants; only one applies. */
  deploy?: { unitType: UnitBaseType; base: boolean; upgraded: boolean }
}

export interface GameData {
  id: GameSystem
  label: string
  defaultFaction: string
  slots: readonly SlotEntry[]
  factions: Readonly<Record<string, Faction>>
  baseUnits: Readonly<Partial<Record<UnitBaseType, UnitDefinition>>>
  /** Every ability reachable through this system, for config validation. */
  allAbilities: readonly RegisteredAbility[]
  /** All shared, faction, and unit abilities registered under a slot. */
  getAbilities(slot: string): readonly RegisteredAbility[]
  getFaction(factionKey: string): Faction
  getFactionUnitConfig(factionKey: string): Record<UnitBaseType, UnitDefinition>
  getAvailableAbilities(
    side: CombatSide,
    factionKey: string,
    upgradedTypes?: ReadonlySet<UnitBaseType>,
  ): CollectedAbility[]
  getUnitDefinitionAbilityKeys(factionKey: string): ReadonlySet<string>
  getFactionOwnedAbilityKeys(factionKey: string): ReadonlySet<string>
}
