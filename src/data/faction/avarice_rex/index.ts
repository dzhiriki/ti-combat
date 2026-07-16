import avariceRexIcon from '@/assets/faction/avarice_rex.svg?raw'
import { sustainDamage } from '@/data/abilities/general/sustain-damage'
import type { Faction } from '@/types'

export const avarice_rex: Faction = {
  name: 'Avarice Rex',
  icon: avariceRexIcon,
  system: 'TWILIGHTS_FALL',
  units: {
    FLAGSHIP: {
      BASE: {
        NAME: 'Scintillia',
        DESCRIPTION:
          'When you splice, gain 2 commodities or convert up to 2 of your commodities to trade goods.',
        FLEET_POOL_COST: 1,
        COST: 8,
        COMBAT: [9, 2],
        MOVE: 1,
        CAPACITY: 3,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [sustainDamage],
      },
    },
    MECH: {
      BASE: {
        NAME: 'Delver',
        DESCRIPTION:
          'When you splice, gain 1 commodity or convert up to 1 of your commodities to trade goods.',
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
