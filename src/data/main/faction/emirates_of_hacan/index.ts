import emiratesOfHacanIcon from '@/assets/faction/emirates_of_hacan.svg?raw'
import { sustainDamage } from '@/data/main/abilities/general/sustain-damage'
import type { Faction } from '@/types'

import { wrathOfKenara } from './wrath-of-kenara'

export const emirates_of_hacan: Faction = {
  name: 'Emirates of Hacan',
  icon: emiratesOfHacanIcon,
  units: {
    FLAGSHIP: {
      BASE: {
        NAME: 'Wrath of Kenara',
        DESCRIPTION:
          'After you roll a die during a space combat in this system, you may spend 1 trade good to apply +1 to the result.',
        FLEET_POOL_COST: 1,
        COST: 8,
        COMBAT: [7, 2],
        MOVE: 1,
        CAPACITY: 3,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [sustainDamage, wrathOfKenara],
      },
    },
    MECH: {
      BASE: {
        NAME: 'Pride of Kenara',
        DESCRIPTION:
          "This planet's planet card may be traded as part of a transaction; if you do, move all of your units from this planet to another planet you control.",
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
