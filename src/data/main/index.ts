import { createGameData } from '../create-game-data'
import actionCard from './abilities/action-card'
import advanced from './abilities/advanced'
import agenda from './abilities/agenda'
import environment from './abilities/environment'
import general from './abilities/general'
import relic from './abilities/relic'
import technology from './abilities/technology'
import { SLOTS } from './ability-slots'
import units from './base-units'
import factions from './faction'

// Twilight Imperium 4 (base + expansions). This module default-exports its
// complete GameData entry point; code outside `src/data` selects it through
// `getGameData` rather than importing system internals.

// Lazy faction definitions (Nekro) resolve through faction and slot lookups.
const gameData = createGameData({
  id: 'TI4',
  label: 'Twilight Imperium',
  factions,
  units,
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
