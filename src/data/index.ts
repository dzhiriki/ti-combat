import type { GameData, GameSystem } from '@/types'

import main from './main'
import tf from './tf'

/**
 * The only application-level registration point for game systems. Adding a
 * system requires importing its GameData entry point and adding it here.
 */
export const GAME_DATA = {
  TI4: main,
  TF: tf,
} as const satisfies Record<GameSystem, GameData>
