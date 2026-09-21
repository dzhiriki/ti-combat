import l1z1xMindnetIcon from '@/assets/faction/l1z1x_mindnet.svg?raw'
import { sustainDamage } from '@/data/main/abilities/general/sustain-damage'
import type { Faction } from '@/types'

import { zerozeroone } from './001'
import { annihilator } from './annihilator'
import { harrow } from './harrow'
import { twoRam } from './two-ram'

export const l1z1x_mindnet: Faction = {
  name: 'L1Z1X Mindnet',
  icon: l1z1xMindnetIcon,
  abilities: {
    ability: [harrow],
    commander: [twoRam],
  },
  units: {
    FLAGSHIP: {
      BASE: {
        NAME: '[0.0.1]',
        DESCRIPTION:
          'During a space combat, hits produced by this ship and by your dreadnoughts in this system must be assigned to non-fighter ships if able.',
        FLEET_POOL_COST: 1,
        COST: 8,
        COMBAT: [5, 2],
        MOVE: 1,
        CAPACITY: 5,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [zerozeroone, sustainDamage],
      },
    },
    MECH: {
      BASE: {
        NAME: 'Annihilator',
        DESCRIPTION:
          'While not participating in ground combat, this unit can use its Bombardment ability on planets in its system as if it were a ship.',
        COST: 2,
        COMBAT: [6, 1],
        CAPACITY_COST: 1,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
          BOMBARDMENT: [8, 1],
        },
        ABILITIES: [sustainDamage, annihilator],
      },
    },
    DREADNOUGHT: {
      BASE: {
        NAME: 'Super Dreadnought I',
        FLEET_POOL_COST: 1,
        COST: 4,
        COMBAT: [5, 1],
        MOVE: 1,
        CAPACITY: 2,
        UNIT_ABILITIES: {
          BOMBARDMENT: [5, 1],
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [sustainDamage],
      },
      UPGRADED: {
        NAME: 'Super Dreadnought II',
        DESCRIPTION:
          'This unit cannot be destroyed by Direct Hit action cards.',
        COMBAT: [4, 1],
        MOVE: 2,
        DIRECT_HIT_IMMUNE: true,
        UNIT_ABILITIES: {
          BOMBARDMENT: [4, 1],
          SUSTAIN_DAMAGE: true,
        },
      },
    },
  },
}
