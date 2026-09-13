import mahactGeneSorcerersIcon from '@/assets/faction/mahact_gene_sorcerers.svg?raw'
import { sustainDamage } from '@/data/main/abilities/general/sustain-damage'
import type { Faction } from '@/types'

import { arviconRex } from './arvicon-rex'

export const mahact_gene_sorcerers: Faction = {
  name: 'Mahact Gene-Sorcerers',
  icon: mahactGeneSorcerersIcon,
  units: {
    FLAGSHIP: {
      BASE: {
        NAME: 'Arvicon Rex',
        DESCRIPTION:
          "During combat against an opponent whose command token is not in your fleet pool, apply +2 to the results of this unit's combat rolls.",
        FLEET_POOL_COST: 1,
        COST: 8,
        COMBAT: [5, 2],
        MOVE: 1,
        CAPACITY: 3,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [arviconRex, sustainDamage],
      },
    },
    MECH: {
      BASE: {
        NAME: 'Starlancer',
        DESCRIPTION:
          'After a player whose command token is in your fleet pool activates this system, you may spend their token from your fleet pool to end their turn; they gain that token.',
        COST: 2,
        COMBAT: [6, 1],
        CAPACITY_COST: 1,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [sustainDamage],
      },
    },
    INFANTRY: {
      BASE: {
        NAME: 'Crimson Legionnaire I',
        DESCRIPTION:
          'After this unit is destroyed, gain 1 commodity or convert 1 of your commodities to a trade good.',
        COST: 0.5,
        COMBAT: [8, 1],
        CAPACITY_COST: 1,
        UNIT_ABILITIES: {},
      },
      UPGRADED: {
        NAME: 'Crimson Legionnaire II',
        DESCRIPTION:
          'After this unit is destroyed, gain 1 commodity or convert 1 of your commodities to a trade good. Then, place the unit of this card. At the start of your next turn, place each unit that is on this card on a planet you control in your home system.',
        COMBAT: [7, 1],
      },
    },
  },
}
