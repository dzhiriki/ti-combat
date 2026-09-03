import * as main from '@/data/main'
import * as tf from '@/data/tf'
import type { GameData, GameSystem } from '@/types'

const DATA_BY_SYSTEM: Record<GameSystem, GameData> = {
  TI4: main,
  TWILIGHTS_FALL: tf,
}

/** The data module (factions, generic units, shared ability pool) for a game
 *  system. Everything outside `src/data` reads game data through this. */
export function getGameData(system: GameSystem): GameData {
  return DATA_BY_SYSTEM[system]
}
