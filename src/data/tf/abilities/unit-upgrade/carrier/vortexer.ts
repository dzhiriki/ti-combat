import vuilraithCabalIcon from '@/assets/faction/vuilraith_cabal.svg?raw'
import type { Ability } from '@/combat'
import { createStatsInvoke } from '@/utils/create-stats-invoke'

export const vortexer: Ability = {
  key: 'TF_UPGRADE_VORTEXER',
  icon: vuilraithCabalIcon,
  name: 'Vortexer',
  params: { isEnabled: false, uses: Infinity },
  headerUI: 'isEnabled',
  exclusiveGroup: 'TF_UNIT_UPGRADE_CARRIER',
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
