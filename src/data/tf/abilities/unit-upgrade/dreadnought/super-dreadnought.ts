import l1z1xMindnetIcon from '@/assets/faction/l1z1x_mindnet.svg?raw'
import type { Ability } from '@/combat'

import { createTfUnitUpgrade } from '../create-tf-unit-upgrade'

export const superDreadnought: Ability = createTfUnitUpgrade({
  key: 'TF_UPGRADE_SUPER_DREADNOUGHT',
  icon: l1z1xMindnetIcon,
  name: 'Super-Dreadnought',
  description: "This unit cannot be destroyed by 'Spark' action cards.",
  unitType: 'DREADNOUGHT',
  cost: 4,
  combat: [5, 1],
  move: 2,
  capacity: 2,
  sustain: true,
  bombardment: [4, 1],
  directHitImmune: true,
})
