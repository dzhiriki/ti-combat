import federationOfSolIcon from '@/assets/faction/federation_of_sol.svg?raw'
import type { Ability } from '@/combat'

import { createTfUnitUpgrade } from '../create-tf-unit-upgrade'

export const advancedCarrier: Ability = createTfUnitUpgrade({
  key: 'TF_UPGRADE_ADVANCED_CARRIER',
  icon: federationOfSolIcon,
  name: 'Advanced Carrier',
  unitType: 'CARRIER',
  cost: 3,
  combat: [9, 1],
  move: 2,
  capacity: 8,
  sustain: true,
})
