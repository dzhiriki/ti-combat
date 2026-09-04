import yinBrotherhoodIcon from '@/assets/faction/yin_brotherhood.svg?raw'
import type { Ability } from '@/combat'

import { createTfUnitUpgrade } from '../create-tf-unit-upgrade'

export const yinClone: Ability = createTfUnitUpgrade({
  key: 'TF_UPGRADE_YIN_CLONE',
  icon: yinBrotherhoodIcon,
  name: 'Yin Clone',
  unitType: 'INFANTRY',
  cost: 0.5,
  combat: [7, 1],
})
