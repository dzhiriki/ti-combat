import l1z1xMindnetIcon from '@/assets/faction/l1z1x_mindnet.svg?raw'
import type { Ability } from '@/combat'
import { sustainDamage } from '@/data/main/abilities/general/sustain-damage'
import { createStatsInvoke } from '@/utils/create-stats-invoke'

export const superDreadnought: Ability = {
  key: 'TF_UPGRADE_SUPER_DREADNOUGHT',
  icon: l1z1xMindnetIcon,
  name: 'Super-Dreadnought',
  description: "This unit cannot be destroyed by 'Spark' action cards.",
  params: { isEnabled: false, uses: Infinity },
  headerUI: 'isEnabled',
  exclusiveGroup: 'UNIT_UPGRADE_DREADNOUGHT',
  invoke: [
    createStatsInvoke('DREADNOUGHT', {
      COST: 4,
      COMBAT: [5, 1],
      MOVE: 2,
      CAPACITY: 2,
      UNIT_ABILITIES: { SUSTAIN_DAMAGE: true, BOMBARDMENT: [4, 1] },
      ABILITIES: [sustainDamage],
      DIRECT_HIT_IMMUNE: true,
    }),
  ],
}
