import type { GameSystem } from '@/types'

import { GAME_SYSTEMS, getGameData } from './get-game-data'

export { GAME_SYSTEMS } from './get-game-data'

export const GAME_SYSTEM_LABELS: Record<GameSystem, string> =
  GAME_SYSTEMS.reduce(
    (labels, system) => {
      labels[system] = getGameData(system).label
      return labels
    },
    {} as Record<GameSystem, string>,
  )

export const DEFAULT_FACTION_BY_SYSTEM: Record<GameSystem, string> =
  GAME_SYSTEMS.reduce(
    (defaults, system) => {
      defaults[system] = getGameData(system).defaultFaction
      return defaults
    },
    {} as Record<GameSystem, string>,
  )
