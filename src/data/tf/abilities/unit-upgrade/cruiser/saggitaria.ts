import councilKeleresIcon from '@/assets/faction/council_keleres.svg?raw'
import type { Ability } from '@/combat'

import { createTfUnitUpgrade } from '../create-tf-unit-upgrade'

export const saggitaria: Ability = createTfUnitUpgrade({
  key: 'TF_UPGRADE_SAGGITARIA',
  icon: councilKeleresIcon,
  name: 'Saggitaria',
  unitType: 'CRUISER',
  cost: 2,
  combat: [6, 1],
  move: 3,
  capacity: 1,
  sustain: true,
})
