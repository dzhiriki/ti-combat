import type { Ability, RegisteredAbility } from '@/combat'
import type { UnitDefinition } from '@/types'

import { resolveFactions } from '../registry'
import actionCard from './abilities/action-card'
import advanced from './abilities/advanced'
import agenda from './abilities/agenda'
import environment from './abilities/environment'
import general from './abilities/general'
import relic from './abilities/relic'
import technology from './abilities/technology'
import {
  type AbilitySlot,
  FACTION_KEY_TO_SLOT,
  unitSlot,
} from './ability-slots'
import baseUnits from './base-units'
import factionDefinitions from './faction'

// Twilight Imperium 4 (base + expansions): the faction roster, the generic
// unit roster, and the shared (non-faction) ability pool. `src/data/tf`
// exposes the same shape for Twilight's Fall (see `GameData`); code outside
// `src/data` must import only these index modules.

export { SHARED_UNIT_ABILITY_KEYS } from './abilities/general'
export type { AbilitySlot } from './ability-slots'
export {
  FACTION_KEY_TO_SLOT,
  SLOT_DISPLAY,
  SLOT_ORDER,
  unitSlot,
} from './ability-slots'
export { default as baseUnits } from './base-units'

function tag(
  abilities: readonly Ability[],
  slot: AbilitySlot,
): RegisteredAbility<AbilitySlot>[] {
  return abilities.map(ability => ({ ability, slot }))
}

// Shared ability pool in registration order — this order drives invoke
// resolution within a timing pass, so keep GENERAL and ADVANCED (the phase
// drivers) first.
export const abilities: readonly RegisteredAbility<AbilitySlot>[] = [
  ...tag(general, 'GENERAL'),
  ...tag(advanced, 'ADVANCED'),
  ...tag(environment, 'ENVIRONMENT'),
  ...tag(agenda, 'AGENDA'),
  ...tag(technology, 'TECHNOLOGY'),
  ...tag(actionCard, 'ACTION_CARD'),
  ...tag(relic, 'RELIC'),
]

// Lazy faction definitions (Nekro) resolve against the static roster and
// the shared decks above; the shared decks import no faction module, so
// there is no cycle here.
export const factions = resolveFactions(
  'TI4',
  // base-units' literal COMBAT: number[] doesn't structurally match
  // DiceGroup's tuple type, so the cast needs an `unknown` bridge.
  baseUnits as unknown as Readonly<Record<string, UnitDefinition>>,
  abilities,
  factionDefinitions,
  { FACTION_KEY_TO_SLOT, unitSlot },
)

export type FactionKey = keyof typeof factions

// Engine hooks that live next to the ability they belong to.
export type { SavedRetreatData } from './abilities/advanced/retreat'
export { settings } from './abilities/general/settings'
