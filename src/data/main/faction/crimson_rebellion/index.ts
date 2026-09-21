import crimsonRebellionIcon from '@/assets/faction/crimson_rebellion.svg?raw'
import { sustainDamage } from '@/data/main/abilities/general/sustain-damage'
import type { Faction } from '@/types'

import { fragmentReality } from './fragment-reality'
import { quietus } from './quietus'

export const crimson_rebellion: Faction = {
  name: 'Crimson Rebellion',
  icon: crimsonRebellionIcon,
  abilities: {
    hero: [fragmentReality],
  },
  units: {
    FLAGSHIP: {
      BASE: {
        NAME: 'Quietus',
        DESCRIPTION:
          "While this unit is in a system that contains an active breach, other players' units in systems with active breaches lose all of their unit abilities.",
        FLEET_POOL_COST: 1,
        COST: 8,
        COMBAT: [5, 2],
        MOVE: 1,
        CAPACITY: 3,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [sustainDamage, quietus],
      },
    },
    MECH: {
      BASE: {
        NAME: 'Revenant',
        DESCRIPTION:
          'Deploy: During the "Commit Ground Forces" step of your tactical action in a system that contains an active breach, you may commit 1 mech, even if you have no units in the system.',
        COST: 2,
        COMBAT: [6, 1],
        CAPACITY_COST: 1,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [sustainDamage],
      },
    },
    DESTROYER: {
      BASE: {
        NAME: 'Exile I',
        DESCRIPTION:
          "At the end of any player's combat in this unit's system or an adjacent system, you may place 1 inactive breach in that system.",
        FLEET_POOL_COST: 1,
        COST: 1,
        COMBAT: [8, 1],
        MOVE: 2,
        UNIT_ABILITIES: {
          AFB: [9, 2],
        },
      },
      UPGRADED: {
        NAME: 'Exile II',
        DESCRIPTION:
          "At the end of any player's combat in this unit's system or up to 2 systems away, you may place 1 active or inactive breach in that system.",
        COMBAT: [7, 1],
        UNIT_ABILITIES: {
          AFB: [6, 3],
        },
      },
    },
  },
}
