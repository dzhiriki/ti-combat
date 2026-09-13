import naazRokhaAllianceIcon from '@/assets/faction/naaz_rokha_alliance.svg?raw'
import { sustainDamage } from '@/data/main/abilities/general/sustain-damage'
import type { Faction } from '@/types'

import { eidolon } from './eidolon'
import { eidolonMaximum } from './eidolon-maximum'
import { supercharge } from './supercharge'
import { viszElVir } from './visz-el-vir'

export const naaz_rokha_alliance: Faction = {
  name: 'Naaz-Rokha Alliance',
  icon: naazRokhaAllianceIcon,
  abilities: {
    technology: [supercharge],
    breakthrough: [eidolonMaximum],
  },
  units: {
    FLAGSHIP: {
      BASE: {
        NAME: 'Visz El Vir',
        DESCRIPTION:
          'Your mechs in this system roll 1 additional die during combat.',
        FLEET_POOL_COST: 1,
        COST: 8,
        COMBAT: [9, 2],
        MOVE: 1,
        CAPACITY: 4,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [viszElVir, sustainDamage],
      },
    },
    MECH: {
      BASE: {
        NAME: 'Eidolon',
        DESCRIPTION:
          'If this unit is in the space area of the active system at the start of a space combat, flip this card.',
        COST: 2,
        COMBAT: [6, 2],
        CAPACITY_COST: 1,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [eidolon, sustainDamage],
      },
    },
  },
}
