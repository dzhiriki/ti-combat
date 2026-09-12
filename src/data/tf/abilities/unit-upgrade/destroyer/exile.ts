import crimsonRebellionIcon from '@/assets/faction/crimson_rebellion.svg?raw'
import type { Ability } from '@/combat'
import { createStatsInvoke } from '@/utils/create-stats-invoke'

export const exile: Ability = {
  key: 'TF_UPGRADE_EXILE',
  icon: crimsonRebellionIcon,
  name: 'Exile',
  params: { isEnabled: false, uses: Infinity },
  headerUI: 'isEnabled',
  exclusiveGroup: 'TF_UNIT_UPGRADE_DESTROYER',
  invoke: [
    createStatsInvoke('DESTROYER', {
      COST: 1,
      COMBAT: [8, 1],
      MOVE: 4,
      UNIT_ABILITIES: { AFB: [6, 3] },
    }),
  ],
}
