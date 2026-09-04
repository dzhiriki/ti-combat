import arborecIcon from '@/assets/faction/arborec.svg?raw'
import type { Ability } from '@/combat'

import { createTfUnitUpgrade } from '../create-tf-unit-upgrade'

export const letaniWarrior: Ability = createTfUnitUpgrade({
  key: 'TF_UPGRADE_LETANI_WARRIOR',
  icon: arborecIcon,
  name: 'Letani Warrior',
  unitType: 'INFANTRY',
  cost: 0.5,
  combat: [7, 1],
  production: 2,
})
