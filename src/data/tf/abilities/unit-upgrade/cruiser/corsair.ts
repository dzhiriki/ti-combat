import mentakCoalitionIcon from '@/assets/faction/mentak_coalition.svg?raw'
import type { Ability } from '@/combat'
import { createStatsInvoke } from '@/utils/create-stats-invoke'

export const corsair: Ability = {
  key: 'TF_UPGRADE_CORSAIR',
  icon: mentakCoalitionIcon,
  name: 'Corsair',
  params: { isEnabled: false, uses: Infinity },
  headerUI: 'isEnabled',
  exclusiveGroup: 'TF_UNIT_UPGRADE_CRUISER',
  invoke: [
    createStatsInvoke('CRUISER', {
      COST: 2,
      COMBAT: [6, 1],
      MOVE: 3,
      CAPACITY: 2,
      UNIT_ABILITIES: {},
    }),
  ],
}
