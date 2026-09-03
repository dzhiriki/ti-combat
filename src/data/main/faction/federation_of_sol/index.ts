import federationOfSolIcon from '@/assets/faction/federation_of_sol.svg?raw'
import { sustainDamage } from '@/data/main/abilities/general/sustain-damage'
import type { Faction } from '@/types'

import { claireGibson } from './claire-gibson'
import { evelynDelouis } from './evelyn-delouis'

export const federation_of_sol: Faction = {
  name: 'Federation of Sol',
  icon: federationOfSolIcon,
  abilities: {
    agent: [evelynDelouis],
    commander: [claireGibson],
  },
  units: {
    FLAGSHIP: {
      BASE: {
        NAME: 'Genesis',
        DESCRIPTION:
          "At the end of the status phase, place 1 infantry from your reinforcements in this system's space area.",
        FLEET_POOL_COST: 1,
        COST: 8,
        COMBAT: [5, 2],
        MOVE: 1,
        CAPACITY: 12,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [sustainDamage],
      },
    },
    MECH: {
      BASE: {
        NAME: 'ZS Thunderbolt M2',
        DESCRIPTION:
          'Deploy: After you use your Orbital Drop faction ability, you may spend 3 resources to place 1 mech on that planet.',
        COST: 2,
        COMBAT: [6, 1],
        CAPACITY_COST: 1,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [sustainDamage],
      },
    },
    CARRIER: {
      BASE: {
        NAME: 'Advanced Carrier I',
        FLEET_POOL_COST: 1,
        COST: 3,
        COMBAT: [9, 1],
        MOVE: 1,
        CAPACITY: 6,
        UNIT_ABILITIES: {},
      },
      UPGRADED: {
        NAME: 'Advanced Carrier II',
        MOVE: 2,
        CAPACITY: 8,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [sustainDamage],
      },
    },
    INFANTRY: {
      BASE: {
        NAME: 'Spec Ops I',
        COST: 0.5,
        COMBAT: [7, 1],
        CAPACITY_COST: 1,
        UNIT_ABILITIES: {},
      },
      UPGRADED: {
        NAME: 'Spec Ops II',
        DESCRIPTION:
          'After this unit is destroyed, roll 1 die. If the result is 5 or greater, place the unit on this card. At the start of your next turn, place each unit that is on this card on a planet you control in your home system.',
        COMBAT: [6, 1],
      },
    },
  },
}
