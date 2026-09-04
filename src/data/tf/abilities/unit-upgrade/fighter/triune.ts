import empyreanIcon from '@/assets/faction/empyrean.svg?raw'
import type { Ability } from '@/combat'

import { createTfUnitUpgrade } from '../create-tf-unit-upgrade'

export const triune: Ability = createTfUnitUpgrade({
  key: 'TF_UPGRADE_TRIUNE',
  icon: empyreanIcon,
  name: 'Triune',
  description:
    'This unit may move without being transported. Fighters in excess of your ships’ capacity count against your fleet pool.',
  unitType: 'FIGHTER',
  cost: 0.5,
  combat: [7, 1],
  move: 2,
  fleetPoolCost: 1,
})
