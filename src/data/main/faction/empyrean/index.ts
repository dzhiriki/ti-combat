import empyreanIcon from '@/assets/faction/empyrean.svg?raw'
import { sustainDamage } from '@/data/main/abilities/general/sustain-damage'
import type { Faction } from '@/types'

import { dynamo } from './dynamo'

export const empyrean: Faction = {
  name: 'Empyrean',
  icon: empyreanIcon,
  units: {
    FLAGSHIP: {
      BASE: {
        NAME: 'Dynamo',
        DESCRIPTION:
          "After any player's unit in this system or an adjacent system uses Sustain Damage, you may spend 2 influence to repair that unit.",
        FLEET_POOL_COST: 1,
        COST: 8,
        COMBAT: [5, 2],
        MOVE: 1,
        CAPACITY: 3,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [sustainDamage, dynamo],
      },
    },
    MECH: {
      BASE: {
        NAME: 'Watcher',
        DESCRIPTION:
          "You may remove this unit from a system that contains or is adjacent to another player's units to cancel an action card played by that player.",
        COST: 2,
        COMBAT: [6, 1],
        CAPACITY_COST: 1,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [sustainDamage],
      },
    },
  },
}
