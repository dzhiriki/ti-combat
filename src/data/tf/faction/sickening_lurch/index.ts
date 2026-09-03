import sickeningLurchIcon from '@/assets/faction/sickening_lurch.svg?raw'
import { sustainDamage } from '@/data/main/abilities/general/sustain-damage'
import type { Faction } from '@/types'

import { bonePickedClean } from './bone-picked-clean'

export const sickening_lurch: Faction = {
  name: 'A Sickening Lurch',
  icon: sickeningLurchIcon,
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
        // "This ship can transport any number of infantry and fighters, and
        // they do not count against this ship's capacity." Only infantry and
        // fighters are free — mechs still pay into the printed capacity of 1.
        // FREE_CARGO is checked against living units by the capacity driver,
        // so the exemption ends the moment the flagship dies and the cleanup
        // enforces real capacity again.
        CAPACITY: 1,
        FREE_CARGO: ['FIGHTER', 'INFANTRY'],
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
