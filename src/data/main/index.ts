import type { Ability, AbilitySlot, RegisteredAbility } from '@/combat'

import actionCard from './abilities/action-card'
import advanced from './abilities/advanced'
import agenda from './abilities/agenda'
import environment from './abilities/environment'
import general from './abilities/general'
import relic from './abilities/relic'
import technology from './abilities/technology'

// Twilight Imperium 4 (base + expansions): the faction roster, the generic
// unit roster, and the shared (non-faction) ability pool. `src/data/tf`
// exposes the same shape for Twilight's Fall (see `GameData`); code outside
// `src/data` must import only these index modules.

export { SHARED_UNIT_ABILITY_KEYS } from './abilities/general'
export { default as baseUnits } from './base-units'
export { default as factions } from './faction'

function tag(
  abilities: readonly Ability[],
  slot: AbilitySlot,
): RegisteredAbility[] {
  return abilities.map(ability => ({ ability, slot }))
}

// Shared ability pool in registration order — this order drives invoke
// resolution within a timing pass, so keep GENERAL and ADVANCED (the phase
// drivers) first.
export const abilities: readonly RegisteredAbility[] = [
  ...tag(general, 'GENERAL'),
  ...tag(advanced, 'ADVANCED'),
  ...tag(environment, 'ENVIRONMENT'),
  ...tag(agenda, 'AGENDA'),
  ...tag(technology, 'TECHNOLOGY'),
  ...tag(actionCard, 'ACTION_CARD'),
  ...tag(relic, 'RELIC'),
]

// Engine hooks that live next to the ability they belong to.
export type { SavedRetreatData } from './abilities/advanced/retreat'
export { settings } from './abilities/general/settings'
