import baronyOfLetnevIcon from '@/assets/faction/barony_of_letnev.svg?raw'
import type { Ability } from '@/combat'

import { createTfUnitUpgrade } from '../create-tf-unit-upgrade'

export const dawncrusher: Ability = createTfUnitUpgrade({
  key: 'TF_UPGRADE_DAWNCRUSHER',
  icon: baronyOfLetnevIcon,
  name: 'Dawncrusher',
  description: "This unit cannot be destroyed by 'Spark' action cards.",
  unitType: 'DREADNOUGHT',
  cost: 3,
  combat: [5, 1],
  move: 2,
  capacity: 1,
  sustain: true,
  bombardment: [4, 1],
  directHitImmune: true,
})
