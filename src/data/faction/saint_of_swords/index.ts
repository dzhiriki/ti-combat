import { sustainDamage } from '@/data/abilities/general/sustain-damage'
import type { Faction } from '@/types'

import { colada } from './colada'

export const saint_of_swords: Faction = {
  name: 'The Saint of Swords',
  system: 'TWILIGHTS_FALL',
  units: {
    FLAGSHIP: {
      BASE: {
        NAME: 'Tizona',
        DESCRIPTION:
          'Apply +1 to the move value of this ship if it would transport 4 units.',
        FLEET_POOL_COST: 1,
        COST: 8,
        COMBAT: [3, 1],
        MOVE: 2,
        CAPACITY: 4,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [sustainDamage],
      },
    },
    MECH: {
      BASE: {
        NAME: 'Colada',
        DESCRIPTION:
          'While this unit is being transported, choose 1 unit in its system that has a capacity value to roll 1 additional die on its combat rolls.',
        COST: 2,
        COMBAT: [6, 1],
        CAPACITY_COST: 1,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [sustainDamage, colada],
      },
    },
  },
}
