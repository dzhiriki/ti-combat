import ghostsOfCreussIcon from '@/assets/faction/ghosts_of_creuss.svg?raw'
import type { Ability } from '@/combat'

import { createTfUnitUpgrade } from '../create-tf-unit-upgrade'

export const ahkSylFier: Ability = createTfUnitUpgrade({
  key: 'TF_UPGRADE_AHK_SYL_FIER',
  icon: ghostsOfCreussIcon,
  name: 'Ahk Syl Fier',
  unitType: 'CRUISER',
  cost: 2,
  combat: [6, 1],
  move: 3,
  capacity: 1,
})
