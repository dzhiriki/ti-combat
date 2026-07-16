import { sustainDamage } from '@/data/abilities/general/sustain-damage'
import type { Faction } from '@/types'

import { starlancerXI } from './starlancer-xi'

export const il_na_viroset: Faction = {
  name: 'Il Na Viroset',
  system: 'TWILIGHTS_FALL',
  units: {
    FLAGSHIP: {
      BASE: {
        NAME: 'Enigma',
        DESCRIPTION:
          'This unit ignores the effects of all anomalies. Its MOVE value is reduced by 1 for each unit it would transport.',
        FLEET_POOL_COST: 1,
        COST: 7,
        COMBAT: [7, 1],
        MOVE: 7,
        CAPACITY: 7,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [sustainDamage],
      },
    },
    MECH: {
      BASE: {
        NAME: 'Starlancer XI',
        DESCRIPTION:
          'This unit participates in space combat as if it were a ship. For each anomaly this unit is in or adjacent to, apply +1 to this unit’s rolls.',
        COST: 2,
        COMBAT: [6, 1],
        CAPACITY_COST: 1,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [sustainDamage, starlancerXI],
      },
    },
  },
}
