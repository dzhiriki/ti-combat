import type { Ability } from '@/combat'
import advanced from '@/data/main/abilities/advanced'
import environment from '@/data/main/abilities/environment'
import general from '@/data/main/abilities/general'
import relic from '@/data/main/abilities/relic'

import { createGameData } from '../create-game-data'
import ability from './abilities/ability'
import actionCard from './abilities/action-card'
import genome from './abilities/genome'
import paradigm from './abilities/paradigm'
import unitUpgrade from './abilities/unit-upgrade'
import { type AbilitySlot, SLOTS } from './ability-slots'
import units from './base-units'
import factions from './faction'

// Twilight's Fall. This module default-exports its complete GameData entry
// point; code outside `src/data` selects it through `getGameData` rather than
// importing system internals.

// Twilight's Fall has none of TI4's faction-locked decks — no agendas, TI4
// technologies, action cards, promissory notes, agents, or commanders. Only
// the generic combat mechanics carry over: GENERAL settings (minus Galvanize,
// which TF doesn't have), the ADVANCED phase drivers, terrain effects, and
// relics. TF's own draw decks are layered on top.
const tfGeneral = general.filter(a => a.key !== 'PRE_GALVANIZED')

const gameData = createGameData({
  id: 'TF',
  label: "Twilight's Fall",
  factions,
  units,
  // Registration order drives invoke resolution order within a timing pass
  // (panel display is grouped by slot instead, so it is unaffected). TF
  // unit-upgrade cards are the TF analog of TI4's build-time UPGRADED stats:
  // their PREPARE applies the stat block that the ADVANCED drivers (Capacity,
  // Fleet Pool) read during their own PREPARE enforcement, so they go first.
  abilities: {
    ...unitUpgrade,
    GENERAL: tfGeneral,
    ADVANCED: advanced,
    ENVIRONMENT: environment,
    RELIC: relic,
    TF_ABILITY: ability,
    TF_GENOME: genome,
    TF_PARADIGM: paradigm,
    TF_ACTION_CARD: actionCard,
  } satisfies Partial<Record<AbilitySlot, readonly Ability[]>>,
  slots: SLOTS,
})

export default gameData
