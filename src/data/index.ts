import type { Faction } from '@/types'

import * as main from './main'
import * as tf from './tf'

export { main, tf }

// Every faction across all game systems, in registry order (TI4 first, then
// Twilight's Fall). Faction keys are unique across systems.
export const factions = {
  ...main.factions,
  ...tf.factions,
} satisfies Record<string, Faction>
