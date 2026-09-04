import deepwroughtScholarateIcon from '@/assets/faction/deepwrought_scholarate.svg?raw'
import type { Ability } from '@/combat'

import { createTfUnitUpgrade } from '../create-tf-unit-upgrade'

// Ambassador's coexistence clause and Vortexer's capture clause are
// out-of-combat effects — only their capacity bump matters here.
export const ambassador: Ability = createTfUnitUpgrade({
  key: 'TF_UPGRADE_AMBASSADOR',
  icon: deepwroughtScholarateIcon,
  name: 'Ambassador',
  unitType: 'CARRIER',
  cost: 3,
  combat: [9, 1],
  move: 2,
  capacity: 6,
})
