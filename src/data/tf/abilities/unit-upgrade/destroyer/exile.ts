import crimsonRebellionIcon from '@/assets/faction/crimson_rebellion.svg?raw'
import type { Ability } from '@/combat'

import { createTfUnitUpgrade } from '../create-tf-unit-upgrade'

export const exile: Ability = createTfUnitUpgrade({
  key: 'TF_UPGRADE_EXILE',
  icon: crimsonRebellionIcon,
  name: 'Exile',
  unitType: 'DESTROYER',
  cost: 1,
  combat: [8, 1],
  move: 4,
  afb: [6, 3],
})
