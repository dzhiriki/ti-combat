import yinBrotherhoodIcon from '@/assets/faction/yin_brotherhood.svg?raw'
import type { Ability } from '@/combat'
import { createStatsInvoke } from '@/utils/create-stats-invoke'

export const yinClone: Ability = {
  key: 'TF_UPGRADE_YIN_CLONE',
  icon: yinBrotherhoodIcon,
  name: 'Yin Clone',
  params: { isEnabled: false, uses: Infinity },
  headerUI: 'isEnabled',
  exclusiveGroup: 'UNIT_UPGRADE_INFANTRY',
  invoke: [
    createStatsInvoke('INFANTRY', {
      COST: 0.5,
      COMBAT: [7, 1],
      UNIT_ABILITIES: {},
    }),
  ],
}
