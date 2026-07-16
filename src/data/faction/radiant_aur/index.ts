import radiantAurIcon from '@/assets/faction/radiant_aur.svg?raw'
import { planetaryShield } from '@/data/abilities/general/planetary-shield'
import { sustainDamage } from '@/data/abilities/general/sustain-damage'
import type { Faction } from '@/types'

import { starlancerII } from './starlancer-ii'

export const radiant_aur: Faction = {
  name: 'Radiant Aur',
  icon: radiantAurIcon,
  system: 'TWILIGHTS_FALL',
  units: {
    FLAGSHIP: {
      BASE: {
        NAME: 'Airo Shir Rex',
        DESCRIPTION:
          'At the end of the edict phase, if this unit is on the game board, draw and resolve 1 edict.',
        FLEET_POOL_COST: 1,
        COST: 8,
        COMBAT: [7, 2],
        MOVE: 1,
        CAPACITY: 6,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
          AFB: [5, 3],
        },
        ABILITIES: [sustainDamage],
      },
    },
    MECH: {
      BASE: {
        NAME: 'Starlancer II',
        DESCRIPTION:
          'At the start of each round of ground combat, you may spend 1 token from your strategy pool to repair all of your mechs.',
        COST: 2,
        COMBAT: [6, 1],
        CAPACITY_COST: 1,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
          PLANETARY_SHIELD: true,
        },
        ABILITIES: [sustainDamage, planetaryShield, starlancerII],
      },
    },
  },
}
