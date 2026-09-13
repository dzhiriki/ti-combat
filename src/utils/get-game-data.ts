import { GAME_DATA } from '@/data'
import type { GameData, GameSystem } from '@/types'

export const GAME_SYSTEMS: readonly GameSystem[] = Object.keys(
  GAME_DATA,
) as GameSystem[]
export const DEFAULT_GAME_SYSTEM = GAME_SYSTEMS[0]

/** The public data entry point for a game system. */
export function getGameData(system: GameSystem): GameData {
  return GAME_DATA[system]
}

export function isGameSystem(value: unknown): value is GameSystem {
  return typeof value === 'string' && Object.hasOwn(GAME_DATA, value)
}
