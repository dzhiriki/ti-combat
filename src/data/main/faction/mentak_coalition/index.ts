import mentakCoalitionIcon from '@/assets/faction/mentak_coalition.svg?raw'
import { sustainDamage } from '@/data/main/abilities/general/sustain-damage'
import type { Faction } from '@/types'

import { ambush } from './ambush'
import { fourthMoon } from './fourth-moon'
import { mollTerminus } from './moll-terminus'
import { salvageOperations } from './salvage-operations'
import { sleeperCell } from './sleeper-cell'

export const mentak_coalition: Faction = {
  name: 'Mentak Coalition',
  icon: mentakCoalitionIcon,
  abilities: {
    faction: [ambush],
    technology: [salvageOperations],
    hero: [sleeperCell],
  },
  units: {
    FLAGSHIP: {
      BASE: {
        NAME: 'Fourth Moon',
        DESCRIPTION:
          "Other players' ships in this system cannot use Sustain Damage.",
        FLEET_POOL_COST: 1,
        COST: 8,
        COMBAT: [7, 2],
        MOVE: 1,
        CAPACITY: 3,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [fourthMoon, sustainDamage],
      },
    },
    MECH: {
      BASE: {
        NAME: 'Moll Terminus',
        DESCRIPTION:
          "Other players' ground forces on this planet cannot use Sustain Damage.",
        COST: 2,
        COMBAT: [6, 1],
        CAPACITY_COST: 1,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [mollTerminus, sustainDamage],
      },
    },
  },
}
