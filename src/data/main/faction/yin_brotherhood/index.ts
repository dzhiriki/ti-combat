import yinBrotherhoodIcon from '@/assets/faction/yin_brotherhood.svg?raw'
import { sustainDamage } from '@/data/main/abilities/general/sustain-damage'
import type { Faction } from '@/types'

import { brotherMilor } from './brother-milor'
import { devotion } from './devotion'
import { greyfireMutagen } from './greyfire-mutagen'
import { impulseCore } from './impulse-core'
import { indoctrination } from './indoctrination'
import { moyinsAshes } from './moyins-ashes'
import { vanHauge } from './van-hauge'

export const yin_brotherhood: Faction = {
  name: 'Yin Brotherhood',
  icon: yinBrotherhoodIcon,
  abilities: {
    faction: [devotion, indoctrination],
    technology: [impulseCore],
    agent: [brotherMilor],
    promissory: [greyfireMutagen],
  },
  units: {
    FLAGSHIP: {
      BASE: {
        NAME: 'Van Hauge',
        DESCRIPTION:
          'When this ship is destroyed, destroy all ships in this system.',
        FLEET_POOL_COST: 1,
        COST: 8,
        COMBAT: [9, 2],
        MOVE: 1,
        CAPACITY: 3,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [vanHauge, sustainDamage],
      },
    },
    MECH: {
      BASE: {
        NAME: "Moyin's Ashes",
        DESCRIPTION:
          "Deploy: When you use your Indoctrination faction ability, you may spend 1 additional influence to replace your opponent's unit with 1 mech instead of 1 infantry.",
        COST: 2,
        COMBAT: [6, 1],
        CAPACITY_COST: 1,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
          DEPLOY: moyinsAshes,
        },
        ABILITIES: [sustainDamage],
      },
    },
  },
}
