import naaluCollectiveIcon from '@/assets/faction/naalu_collective.svg?raw'
import type { Ability } from '@/combat'

import { createTfUnitUpgrade } from '../create-tf-unit-upgrade'

// The fighter cards (Hybrid Crystal Fighter, Morphwing, Triune) all carry
// the Fighter II movement/fleet-pool clause: fighters fill ship capacity
// first and only the excess counts against the fleet pool — at 1/2 a ship
// each for Hybrid Crystal Fighter, 1 for the others.
export const hybridCrystalFighter: Ability = createTfUnitUpgrade({
  key: 'TF_UPGRADE_HYBRID_CRYSTAL_FIGHTER',
  icon: naaluCollectiveIcon,
  name: 'Hybrid Crystal Fighter',
  description:
    "This unit may move without being transported. Each fighter in excess of your ships' capacity counts as 1/2 of a ship against your fleet pool.",
  unitType: 'FIGHTER',
  cost: 0.5,
  combat: [7, 1],
  move: 2,
  fleetPoolCost: 0.5,
})
