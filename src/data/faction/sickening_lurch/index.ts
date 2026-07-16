import { sustainDamage } from '@/data/abilities/general/sustain-damage'
import type { Faction } from '@/types'

import { bonePickedClean } from './bone-picked-clean'

export const sickening_lurch: Faction = {
  name: 'A Sickening Lurch',
  system: 'TWILIGHTS_FALL',
  units: {
    FLAGSHIP: {
      BASE: {
        NAME: 'A Strangled Whisper',
        DESCRIPTION:
          "This ship can transport any number of infantry and fighters, and they do not count against this ship's capacity.",
        FLEET_POOL_COST: 1,
        COST: 8,
        COMBAT: [7, 2],
        MOVE: 1,
        CAPACITY: 1,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
          BOMBARDMENT: [7, 1],
        },
        ABILITIES: [sustainDamage],
      },
    },
    MECH: {
      BASE: {
        NAME: 'Bone Picked Clean',
        DESCRIPTION:
          'When you splice, capture 1 infantry from the reinforcements of any player with adjacent units; you can spend 1 captured infantry after rolling during combat to reroll this unit’s dice.',
        COST: 2,
        COMBAT: [5, 2],
        CAPACITY_COST: 1,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [sustainDamage, bonePickedClean],
      },
    },
  },
}
