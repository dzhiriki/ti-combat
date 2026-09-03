import councilKeleresIcon from '@/assets/faction/council_keleres.svg?raw'
import { sustainDamage } from '@/data/main/abilities/general/sustain-damage'
import type { Faction } from '@/types'

import { custodiaVigilia } from './custodia-vigilia'
import { overwingZeta } from './overwing-zeta'

export const council_keleres: Faction = {
  name: 'Council Keleres',
  icon: councilKeleresIcon,
  abilities: {
    faction: [custodiaVigilia],
    hero: [overwingZeta],
  },
  units: {
    FLAGSHIP: {
      BASE: {
        NAME: 'Artemiris',
        DESCRIPTION:
          'Other players must spend 2 influence to activate this system.',
        FLEET_POOL_COST: 1,
        COST: 8,
        COMBAT: [7, 2],
        MOVE: 1,
        CAPACITY: 6,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [sustainDamage],
      },
    },
    MECH: {
      BASE: {
        NAME: 'Omniopiares',
        DESCRIPTION:
          'Other players must spend 1 influence to commit ground forces to this planet.',
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
