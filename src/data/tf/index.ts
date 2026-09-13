import type { Ability, RegisteredAbility } from '@/combat'
import { UNIT_DISPLAY_NAMES } from '@/constants/units'
import advanced from '@/data/main/abilities/advanced'
import environment from '@/data/main/abilities/environment'
import general from '@/data/main/abilities/general'
import relic from '@/data/main/abilities/relic'
import type { UnitBaseType, UnitDefinition } from '@/types'

import { resolveFactions } from '../registry'
import ability from './abilities/ability'
import actionCard from './abilities/action-card'
import genome from './abilities/genome'
import paradigm from './abilities/paradigm'
import unitUpgrade from './abilities/unit-upgrade'
import {
  type AbilitySlot,
  FACTION_KEY_TO_SLOT,
  unitSlot,
} from './ability-slots'
import baseUnits from './base-units'
import factionDefinitions from './faction'

// Twilight's Fall: the faction roster, the generic unit roster, and every
// shared (non-faction) ability available in a TF session. Same shape as
// `src/data/main` (see `GameData`); code outside `src/data` must import only
// these index modules.

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

// Twilight's Fall has none of TI4's faction-locked decks — no agendas, TI4
// technologies, action cards, promissory notes, agents, or commanders. Only
// the generic combat mechanics carry over: GENERAL settings (minus Galvanize,
// which TF doesn't have), the ADVANCED phase drivers, terrain effects, and
// relics. TF's own draw decks are layered on top.
const tfGeneral = general.filter(a => a.key !== 'PRE_GALVANIZED')

// The unit-upgrade deck spans every unit type, so each card carries its unit
// type as the panel sub-header (the deck is grouped by unit type in display
// order — see `abilities/unit-upgrade`).
const unitUpgrades: RegisteredAbility<AbilitySlot>[] = Object.entries(
  unitUpgrade,
).flatMap(([unitType, cards]) =>
  cards.map(card => ({
    slot: 'TF_UNIT_UPGRADE' as const,
    subcategory: UNIT_DISPLAY_NAMES[unitType as UnitBaseType],
    ability: card,
  })),
)

// Registration order drives invoke resolution order within a timing pass
// (panel display is grouped by slot instead, so it is unaffected). TF
// unit-upgrade cards are the TF analog of TI4's build-time UPGRADED stats:
// their PREPARE applies the stat block that the ADVANCED drivers (Capacity,
// Fleet Pool) read during their own PREPARE enforcement, so they go first.
export const abilities: readonly RegisteredAbility<AbilitySlot>[] = [
  ...unitUpgrades,
  ...tag(tfGeneral, 'GENERAL'),
  ...tag(advanced, 'ADVANCED'),
  ...tag(environment, 'ENVIRONMENT'),
  ...tag(relic, 'RELIC'),
  ...tag(ability, 'TF_ABILITY'),
  ...tag(genome, 'TF_GENOME'),
  ...tag(paradigm, 'TF_PARADIGM'),
  ...tag(actionCard, 'TF_ACTION_CARD'),
]

export const factions = resolveFactions(
  'TF',
  // base-units' literal COMBAT: number[] doesn't structurally match
  // DiceGroup's tuple type, so the cast needs an `unknown` bridge.
  baseUnits as unknown as Readonly<Record<string, UnitDefinition>>,
  abilities,
  factionDefinitions,
  { FACTION_KEY_TO_SLOT, unitSlot },
)

export type FactionKey = keyof typeof factions
