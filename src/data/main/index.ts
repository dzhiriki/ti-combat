import type { Ability, RegisteredAbility } from '@/combat'
import type { UnitDefinition } from '@/types'

import { createGameData } from '../create-game-data'
import actionCard from './abilities/action-card'
import advanced from './abilities/advanced'
import agenda from './abilities/agenda'
import environment from './abilities/environment'
import general, { SHARED_UNIT_ABILITY_KEYS } from './abilities/general'
import relic from './abilities/relic'
import technology from './abilities/technology'
import {
  type AbilitySlot,
  FACTION_KEY_TO_SLOT,
  SLOT_DISPLAY,
  SLOT_ORDER,
  unitSlot,
} from './ability-slots'
import baseUnits from './base-units'
import factionDefinitions from './faction'

// Twilight Imperium 4 (base + expansions). This module default-exports its
// complete GameData entry point; code outside `src/data` selects it through
// `getGameData` rather than importing system internals.

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
const sharedAbilities: readonly RegisteredAbility<AbilitySlot>[] = [
  ...tag(general, 'GENERAL'),
  ...tag(advanced, 'ADVANCED'),
  ...tag(environment, 'ENVIRONMENT'),
  ...tag(agenda, 'AGENDA'),
  ...tag(technology, 'TECHNOLOGY'),
  ...tag(actionCard, 'ACTION_CARD'),
  ...tag(relic, 'RELIC'),
]

// Lazy faction definitions (Nekro) resolve against this same GameData entity.
const gameData = createGameData({
  id: 'TI4',
  label: 'Twilight Imperium',
  factionDefinitions,
  // base-units' literal COMBAT: number[] doesn't structurally match
  // DiceGroup's tuple type, so the cast needs an `unknown` bridge.
  baseUnits: baseUnits as unknown as Readonly<Record<string, UnitDefinition>>,
  sharedAbilities,
  FACTION_KEY_TO_SLOT,
  unitSlot,
  SLOT_DISPLAY,
  SLOT_ORDER,
  sharedUnitAbilityKeys: SHARED_UNIT_ABILITY_KEYS,
  crossFactionPools: [
    { factionGroup: 'promissory', slot: 'PROMISSORY' },
    { factionGroup: 'agent', slot: 'AGENT' },
    { factionGroup: 'commander', slot: 'COMMANDER' },
  ],
  externalAbilityPool: { slot: 'OTHER' },
  omitOwnFactionGroups: ['promissory'],
  ownFactionSlotOverrides: {
    agent: 'FACTION_AGENT',
    commander: 'FACTION_COMMANDER',
  },
  neutral: {
    hiddenSlots: [
      'AGENDA',
      'TECHNOLOGY',
      'ACTION_CARD',
      'COMMANDER',
      'RELIC',
      'PROMISSORY',
    ],
    hiddenAbilityKeys: ['FLEET_POOL'],
  },
})

export const factions = gameData.factions
export type FactionKey = keyof typeof factions
export const abilities = gameData.abilities
export const allAbilities = gameData.allAbilities
export default gameData

// Engine hooks that live next to the ability they belong to.
export type { SavedRetreatData } from './abilities/advanced/retreat'
export { settings } from './abilities/general/settings'
