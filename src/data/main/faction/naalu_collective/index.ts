import naaluCollectiveIcon from '@/assets/faction/naalu_collective.svg?raw'
import { sustainDamage } from '@/data/main/abilities/general/sustain-damage'
import type { Faction } from '@/types'

import { matriarch } from './matriarch'

export const naalu_collective: Faction = {
  name: 'Naalu Collective',
  icon: naaluCollectiveIcon,
  units: {
    FLAGSHIP: {
      BASE: {
        NAME: 'Matriarch',
        DESCRIPTION:
          'During an invasion in this system, you may commit fighters to planets as if they were ground forces. When combat ends, return those units to the space area.',
        FLEET_POOL_COST: 1,
        COST: 8,
        COMBAT: [9, 2],
        MOVE: 1,
        CAPACITY: 6,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [matriarch, sustainDamage],
      },
    },
    MECH: {
      BASE: {
        NAME: 'Iconoclast',
        DESCRIPTION:
          "During combat against an opponent who has at least 1 relic fragment, apply +2 to the results of this unit's combat rolls.",
        COST: 2,
        COMBAT: [6, 1],
        CAPACITY_COST: 1,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [sustainDamage],
      },
    },
    FIGHTER: {
      BASE: {
        NAME: 'Hybrid Crystal Fighter I',
        COST: 0.5,
        COMBAT: [8, 1],
        CAPACITY_COST: 1,
        UNIT_ABILITIES: {},
      },
      UPGRADED: {
        NAME: 'Hybrid Crystal Fighter II',
        DESCRIPTION:
          "This unit may move without being transported. Each fighter in excess of your ships' capacity counts as 1/2 of a ship against your fleet pool.",
        FLEET_POOL_COST: 0.5,
        COMBAT: [7, 1],
        MOVE: 2,
      },
    },
  },
}
