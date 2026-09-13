import argentFlightIcon from '@/assets/faction/argent_flight.svg?raw'
import { sustainDamage } from '@/data/main/abilities/general/sustain-damage'
import type { Faction } from '@/types'

import { quetzecoatl } from './quetzecoatl'
import { raidFormation } from './raid-formation'
import { strikeWingAlphaII } from './strike-wing-alpha-ii'
import { strikeWingAmbuscade } from './strike-wing-ambuscade'
import { trrakanAunZulok } from './trrakan-aun-zulok'

export const argent_flight: Faction = {
  name: 'Argent Flight',
  icon: argentFlightIcon,
  abilities: {
    ability: [raidFormation],
    promissory: [strikeWingAmbuscade],
    commander: [trrakanAunZulok],
  },
  units: {
    FLAGSHIP: {
      BASE: {
        NAME: 'Quetzecoatl',
        DESCRIPTION:
          'Other players cannot use Space Cannon against your ships in this system.',
        FLEET_POOL_COST: 1,
        COST: 8,
        COMBAT: [7, 2],
        MOVE: 1,
        CAPACITY: 3,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [quetzecoatl, sustainDamage],
      },
    },
    MECH: {
      BASE: {
        NAME: 'Aerie Sentinel',
        DESCRIPTION:
          'This unit does not count against capacity if it is being transported or if it in a space area with 1 or more of your ships that have capacity values.',
        COST: 2,
        COMBAT: [6, 1],
        CAPACITY_COST: 0,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [sustainDamage],
      },
    },
    DESTROYER: {
      BASE: {
        NAME: 'Strike Wing Alpha I',
        FLEET_POOL_COST: 1,
        COST: 1,
        COMBAT: [8, 1],
        MOVE: 2,
        CAPACITY: 1,
        UNIT_ABILITIES: {
          AFB: [9, 2],
        },
      },
      UPGRADED: {
        NAME: 'Strike Wing Alpha II',
        DESCRIPTION:
          "When this unit uses Anti-Fighter Barrage, each result of 9 or 10 also destroys 1 of your opponent's infantry in the space area of the active system.",
        COMBAT: [7, 1],
        UNIT_ABILITIES: {
          AFB: [6, 3],
        },
        ABILITIES: [strikeWingAlphaII],
      },
    },
  },
}
