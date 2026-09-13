import deepwroughtScholarateIcon from '@/assets/faction/deepwrought_scholarate.svg?raw'
import type { Ability } from '@/combat'
import { createStatsInvoke } from '@/utils/create-stats-invoke'

// Ambassador's coexistence clause and Vortexer's capture clause are
// out-of-combat effects — only their capacity bump matters here.
export const ambassador: Ability = {
  key: 'TF_UPGRADE_AMBASSADOR',
  icon: deepwroughtScholarateIcon,
  name: 'Ambassador',
  params: { isEnabled: false, uses: Infinity },
  headerUI: 'isEnabled',
  exclusiveGroup: 'UNIT_UPGRADE_CARRIER',
  invoke: [
    createStatsInvoke('CARRIER', {
      COST: 3,
      COMBAT: [9, 1],
      MOVE: 2,
      CAPACITY: 6,
      UNIT_ABILITIES: {},
    }),
  ],
}
