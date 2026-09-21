import arborecIcon from '@/assets/faction/arborec.svg?raw'
import type { Ability } from '@/combat'
import { createStatsInvoke } from '@/utils/create-stats-invoke'

export const letaniWarrior: Ability = {
  key: 'TF_UPGRADE_LETANI_WARRIOR',
  icon: arborecIcon,
  name: 'Letani Warrior',
  params: { isEnabled: false, uses: Infinity },
  headerUI: 'isEnabled',
  exclusiveGroup: 'UNIT_UPGRADE_INFANTRY',
  invoke: [
    createStatsInvoke('INFANTRY', {
      COST: 0.5,
      COMBAT: [7, 1],
      UNIT_ABILITIES: { PRODUCTION: 2 },
    }),
  ],
}
