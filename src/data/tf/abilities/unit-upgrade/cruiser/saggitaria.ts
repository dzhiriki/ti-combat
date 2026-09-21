import councilKeleresIcon from '@/assets/faction/council_keleres.svg?raw'
import type { Ability } from '@/combat'
import { sustainDamage } from '@/data/main/abilities/general/sustain-damage'
import { createStatsInvoke } from '@/utils/create-stats-invoke'

export const saggitaria: Ability = {
  key: 'TF_UPGRADE_SAGGITARIA',
  icon: councilKeleresIcon,
  name: 'Saggitaria',
  params: { isEnabled: false, uses: Infinity },
  headerUI: 'isEnabled',
  exclusiveGroup: 'UNIT_UPGRADE_CRUISER',
  invoke: [
    createStatsInvoke('CRUISER', {
      COST: 2,
      COMBAT: [6, 1],
      MOVE: 3,
      CAPACITY: 1,
      UNIT_ABILITIES: { SUSTAIN_DAMAGE: true },
      ABILITIES: [sustainDamage],
    }),
  ],
}
