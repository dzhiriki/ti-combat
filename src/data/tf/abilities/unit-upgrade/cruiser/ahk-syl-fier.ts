import ghostsOfCreussIcon from '@/assets/faction/ghosts_of_creuss.svg?raw'
import type { Ability } from '@/combat'
import { createStatsInvoke } from '@/utils/create-stats-invoke'

export const ahkSylFier: Ability = {
  key: 'TF_UPGRADE_AHK_SYL_FIER',
  icon: ghostsOfCreussIcon,
  name: 'Ahk Syl Fier',
  params: { isEnabled: false, uses: Infinity },
  headerUI: 'isEnabled',
  exclusiveGroup: 'TF_UNIT_UPGRADE_CRUISER',
  invoke: [
    createStatsInvoke('CRUISER', {
      COST: 2,
      COMBAT: [6, 1],
      MOVE: 3,
      CAPACITY: 1,
      UNIT_ABILITIES: {},
    }),
  ],
}
