import type { UnitDefinition } from '@/types'

import { createGameData } from '../create-game-data'
import actionCard from './abilities/action-card'
import advanced from './abilities/advanced'
import agenda from './abilities/agenda'
import environment from './abilities/environment'
import general from './abilities/general'
import relic from './abilities/relic'
import technology from './abilities/technology'
import { SLOTS } from './ability-slots'
import baseUnits from './base-units'
import factions from './faction'

// Twilight Imperium 4 (base + expansions). This module default-exports its
// complete GameData entry point; code outside `src/data` selects it through
// `getGameData` rather than importing system internals.

// Lazy faction definitions (Nekro) resolve against this same GameData entity.
const gameData = createGameData({
  id: 'TI4',
  label: 'Twilight Imperium',
  factions,
  // base-units' literal COMBAT: number[] doesn't structurally match
  // DiceGroup's tuple type, so the cast needs an `unknown` bridge.
  units: baseUnits as unknown as Readonly<Record<string, UnitDefinition>>,
  abilities: {
    GENERAL: general,
    ADVANCED: advanced,
    ENVIRONMENT: environment,
    AGENDA: agenda,
    TECHNOLOGY: technology,
    ACTION_CARD: actionCard,
    RELIC: relic,
  },
  slots: SLOTS,
})

export default gameData

// Engine hooks that live next to the ability they belong to.
export type { SavedRetreatData } from './abilities/advanced/retreat'
export { settings } from './abilities/general/settings'
