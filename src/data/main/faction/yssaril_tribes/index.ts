import yssarilTribesIcon from '@/assets/faction/yssaril_tribes.svg?raw'
import { sustainDamage } from '@/data/main/abilities/general/sustain-damage'
import type { Faction } from '@/types'

import { ssruu } from './ssruu'

export const yssaril_tribes: Faction = {
  name: 'Yssaril Tribes',
  icon: yssarilTribesIcon,
  abilities: {
    agent: [ssruu],
  },
  units: {
    FLAGSHIP: {
      BASE: {
        NAME: "Y'sia Y'ssrila",
        DESCRIPTION:
          "This ship can move through systems that contain other player's ships.",
        FLEET_POOL_COST: 1,
        COST: 8,
        COMBAT: [5, 2],
        MOVE: 2,
        CAPACITY: 3,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [sustainDamage],
      },
    },
    MECH: {
      BASE: {
        NAME: 'Blackshade Infiltrator',
        DESCRIPTION:
          'Deploy: After you use your Stall Tactics faction ability, you may place 1 mech on a planet you control.',
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
