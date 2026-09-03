import titansOfUlIcon from '@/assets/faction/titans_of_ul.svg?raw'
import { planetaryShield } from '@/data/main/abilities/general/planetary-shield'
import { sustainDamage } from '@/data/main/abilities/general/sustain-damage'
import type { Faction } from '@/types'

import { geoform } from './geoform'
import { helTitan } from './hel-titan'
import { tellurian } from './tellurian'

export const titans_of_ul: Faction = {
  name: 'Titans of Ul',
  icon: titansOfUlIcon,
  abilities: {
    agent: [tellurian],
    hero: [geoform],
  },
  units: {
    FLAGSHIP: {
      BASE: {
        NAME: 'Ouranos',
        DESCRIPTION:
          'Deploy: After you activate a system that contains 1 or more of your PDS, you may replace 1 of those PDS with this unit.',
        FLEET_POOL_COST: 1,
        COST: 8,
        COMBAT: [7, 2],
        MOVE: 1,
        CAPACITY: 3,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [sustainDamage],
      },
    },
    MECH: {
      BASE: {
        NAME: 'Hecatoncheires',
        DESCRIPTION:
          'Deploy: When you would place a PDS on a planet, you may place 1 mech and 1 infantry on that planet instead.',
        COST: 2,
        COMBAT: [6, 1],
        CAPACITY_COST: 1,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [sustainDamage],
      },
    },
    CRUISER: {
      BASE: {
        NAME: 'Saturn Engine I',
        FLEET_POOL_COST: 1,
        COST: 2,
        COMBAT: [7, 1],
        MOVE: 2,
        CAPACITY: 1,
        UNIT_ABILITIES: {},
      },
      UPGRADED: {
        NAME: 'Saturn Engine II',
        COMBAT: [6, 1],
        MOVE: 3,
        CAPACITY: 2,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [sustainDamage],
      },
    },
    PDS: {
      BASE: {
        NAME: 'Hel-Titan I',
        DESCRIPTION:
          'This unit is treated as both a structure and a ground force. It cannot be transported.',
        COMBAT: [7, 1],
        UNIT_ABILITIES: {
          PLANETARY_SHIELD: true,
          SUSTAIN_DAMAGE: true,
          SPACE_CANNON: [6, 1],
          PRODUCTION: 1,
        },
        ABILITIES: [planetaryShield, sustainDamage, helTitan],
      },
      UPGRADED: {
        NAME: 'Hel-Titan II',
        DESCRIPTION:
          "This unit is treated as both a structure and a ground force. It cannot be transported. You may use this unit's Space Cannon against ships that are adjacent to this unit's system.",
        COMBAT: [6, 1],
        UNIT_ABILITIES: {
          SPACE_CANNON: [5, 1],
        },
      },
    },
  },
}
