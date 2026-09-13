import empyreanIcon from '@/assets/faction/empyrean.svg?raw'
import type { Ability } from '@/combat'
import { createStatsInvoke } from '@/utils/create-stats-invoke'

export const triune: Ability = {
  key: 'TF_UPGRADE_TRIUNE',
  icon: empyreanIcon,
  name: 'Triune',
  description:
    'This unit may move without being transported. Fighters in excess of your ships’ capacity count against your fleet pool.',
  params: { isEnabled: false, uses: Infinity },
  headerUI: 'isEnabled',
  exclusiveGroup: 'UNIT_UPGRADE_FIGHTER',
  invoke: [
    createStatsInvoke('FIGHTER', {
      COST: 0.5,
      COMBAT: [7, 1],
      MOVE: 2,
      FLEET_POOL_COST: 1,
      UNIT_ABILITIES: {},
    }),
  ],
}
