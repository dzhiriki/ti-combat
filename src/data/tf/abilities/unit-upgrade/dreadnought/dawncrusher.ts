import baronyOfLetnevIcon from '@/assets/faction/barony_of_letnev.svg?raw'
import type { Ability } from '@/combat'
import { sustainDamage } from '@/data/main/abilities/general/sustain-damage'
import { createStatsInvoke } from '@/utils/create-stats-invoke'

export const dawncrusher: Ability = {
  key: 'TF_UPGRADE_DAWNCRUSHER',
  icon: baronyOfLetnevIcon,
  name: 'Dawncrusher',
  description: "This unit cannot be destroyed by 'Spark' action cards.",
  params: { isEnabled: false, uses: Infinity },
  headerUI: 'isEnabled',
  exclusiveGroup: 'TF_UNIT_UPGRADE_DREADNOUGHT',
  invoke: [
    createStatsInvoke('DREADNOUGHT', {
      COST: 3,
      COMBAT: [5, 1],
      MOVE: 2,
      CAPACITY: 1,
      UNIT_ABILITIES: { SUSTAIN_DAMAGE: true, BOMBARDMENT: [4, 1] },
      ABILITIES: [sustainDamage],
      DIRECT_HIT_IMMUNE: true,
    }),
  ],
}
