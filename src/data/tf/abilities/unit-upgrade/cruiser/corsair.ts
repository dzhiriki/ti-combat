import mentakCoalitionIcon from '@/assets/faction/mentak_coalition.svg?raw'
import type { Ability } from '@/combat'

import { createTfUnitUpgrade } from '../create-tf-unit-upgrade'

export const corsair: Ability = createTfUnitUpgrade({
  key: 'TF_UPGRADE_CORSAIR',
  icon: mentakCoalitionIcon,
  name: 'Corsair',
  unitType: 'CRUISER',
  cost: 2,
  combat: [6, 1],
  move: 3,
  capacity: 2,
})
