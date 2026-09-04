import vuilraithCabalIcon from '@/assets/faction/vuilraith_cabal.svg?raw'
import type { Ability } from '@/combat'

import { createTfUnitUpgrade } from '../create-tf-unit-upgrade'

export const vortexer: Ability = createTfUnitUpgrade({
  key: 'TF_UPGRADE_VORTEXER',
  icon: vuilraithCabalIcon,
  name: 'Vortexer',
  unitType: 'CARRIER',
  cost: 3,
  combat: [9, 1],
  move: 2,
  capacity: 6,
})
