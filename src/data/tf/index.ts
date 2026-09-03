import type { Ability, AbilitySlot, RegisteredAbility } from '@/combat'
import advanced from '@/data/main/abilities/advanced'
import environment from '@/data/main/abilities/environment'
import general from '@/data/main/abilities/general'
import relic from '@/data/main/abilities/relic'
import type { UnitDefinition } from '@/types'

import { resolveFactions } from '../registry'
import { TF_SHARED_REGISTERED } from './abilities'
import baseUnits from './base-units'
import factionDefinitions from './faction'

// Twilight's Fall: the faction roster, the generic unit roster, and every
// shared (non-faction) ability available in a TF session. Same shape as
// `src/data/main` (see `GameData`); code outside `src/data` must import only
// these index modules.

export { default as baseUnits } from './base-units'

function tag(
  abilities: readonly Ability[],
  slot: AbilitySlot,
): RegisteredAbility[] {
  return abilities.map(ability => ({ ability, slot }))
}

// Twilight's Fall has none of TI4's faction-locked decks — no agendas, TI4
// technologies, action cards, promissory notes, agents, or commanders. Only
// the generic combat mechanics carry over: GENERAL settings (minus Galvanize,
// which TF doesn't have), the ADVANCED phase drivers, terrain effects, and
// relics. TF's own draw decks are layered on top.
const tfGeneral = general.filter(a => a.key !== 'PRE_GALVANIZED')
const unitUpgrades = TF_SHARED_REGISTERED.filter(
  r => r.slot === 'TF_UNIT_UPGRADE',
)
const decks = TF_SHARED_REGISTERED.filter(r => r.slot !== 'TF_UNIT_UPGRADE')

// Registration order drives invoke resolution order within a timing pass
// (panel display is grouped by slot instead, so it is unaffected). TF
// unit-upgrade cards are the TF analog of TI4's build-time UPGRADED stats:
// their PREPARE applies the stat block that the ADVANCED drivers (Capacity,
// Fleet Pool) read during their own PREPARE enforcement, so they go first.
export const abilities: readonly RegisteredAbility[] = [
  ...unitUpgrades,
  ...tag(tfGeneral, 'GENERAL'),
  ...tag(advanced, 'ADVANCED'),
  ...tag(environment, 'ENVIRONMENT'),
  ...tag(relic, 'RELIC'),
  ...decks,
]

export const factions = resolveFactions(
  'TWILIGHTS_FALL',
  // base-units' literal COMBAT: number[] doesn't structurally match
  // DiceGroup's tuple type, so the cast needs an `unknown` bridge.
  baseUnits as unknown as Readonly<Record<string, UnitDefinition>>,
  abilities,
  factionDefinitions,
)
