import winnuIcon from '@/assets/faction/winnu.svg?raw'
import { sustainDamage } from '@/data/main/abilities/general/sustain-damage'
import type { Faction } from '@/types'

import { imperator } from './imperator'
import { rickarRickani } from './rickar-rickani'
import { salaiSaiCorian } from './salai-sai-corian'

export const winnu: Faction = {
  name: 'Winnu',
  icon: winnuIcon,
  abilities: {
    commander: [rickarRickani],
    breakthrough: [imperator],
  },
  units: {
    FLAGSHIP: {
      BASE: {
        NAME: 'Salai Sai Corian',
        DESCRIPTION:
          "When this unit makes a combat roll, it rolls a number of dice equal to the number of your opponent's non-fighter ships in this system.",
        FLEET_POOL_COST: 1,
        COST: 8,
        COMBAT: [7, 1],
        MOVE: 1,
        CAPACITY: 3,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [sustainDamage, salaiSaiCorian],
      },
    },
    MECH: {
      BASE: {
        NAME: 'Reclaimer',
        DESCRIPTION:
          'After you resolve a tactical action during which you gained control of this planet, you may place 1 PDS or 1 space dock from your reinforcements on this planet.',
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
