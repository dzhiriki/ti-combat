import naaluCollectiveIcon from '@/assets/faction/naalu_collective.svg?raw'
import type { Ability } from '@/combat'
import { createStatsInvoke } from '@/utils/create-stats-invoke'

// The fighter cards (Hybrid Crystal Fighter, Morphwing, Triune) all carry
// the Fighter II movement/fleet-pool clause: fighters fill ship capacity
// first and only the excess counts against the fleet pool — at 1/2 a ship
// each for Hybrid Crystal Fighter, 1 for the others.
export const hybridCrystalFighter: Ability = {
  key: 'TF_UPGRADE_HYBRID_CRYSTAL_FIGHTER',
  icon: naaluCollectiveIcon,
  name: 'Hybrid Crystal Fighter',
  description:
    "This unit may move without being transported. Each fighter in excess of your ships' capacity counts as 1/2 of a ship against your fleet pool.",
  params: { isEnabled: false, uses: Infinity },
  headerUI: 'isEnabled',
  exclusiveGroup: 'UNIT_UPGRADE_FIGHTER',
  invoke: [
    createStatsInvoke('FIGHTER', {
      COST: 0.5,
      COMBAT: [7, 1],
      MOVE: 2,
      FLEET_POOL_COST: 0.5,
      UNIT_ABILITIES: {},
    }),
  ],
}
