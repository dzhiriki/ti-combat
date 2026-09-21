import federationOfSolIcon from '@/assets/faction/federation_of_sol.svg?raw'
import type { Ability } from '@/combat'
import { sustainDamage } from '@/data/main/abilities/general/sustain-damage'
import { createStatsInvoke } from '@/utils/create-stats-invoke'

export const advancedCarrier: Ability = {
  key: 'TF_UPGRADE_ADVANCED_CARRIER',
  icon: federationOfSolIcon,
  name: 'Advanced Carrier',
  params: { isEnabled: false, uses: Infinity },
  headerUI: 'isEnabled',
  exclusiveGroup: 'UNIT_UPGRADE_CARRIER',
  invoke: [
    createStatsInvoke('CARRIER', {
      COST: 3,
      COMBAT: [9, 1],
      MOVE: 2,
      CAPACITY: 8,
      UNIT_ABILITIES: { SUSTAIN_DAMAGE: true },
      ABILITIES: [sustainDamage],
    }),
  ],
}
