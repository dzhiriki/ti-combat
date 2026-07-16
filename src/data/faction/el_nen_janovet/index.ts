import { sustainDamage } from '@/data/abilities/general/sustain-damage'
import type { Faction } from '@/types'

export const el_nen_janovet: Faction = {
  name: 'El Nen Janovet',
  system: 'TWILIGHTS_FALL',
  units: {
    FLAGSHIP: {
      BASE: {
        NAME: 'The Faces of Janovet',
        DESCRIPTION:
          'This unit gains the unit abilities and text abilities of your destroyer, cruiser, and dreadnought unit upgrade technologies.',
        FLEET_POOL_COST: 1,
        COST: 8,
        COMBAT: [5, 2],
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
        NAME: 'Analyzer',
        DESCRIPTION:
          'After you win a ground combat in which this unit participated, you may return this unit to your reinforcements to draw 1 unit upgrade.',
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
