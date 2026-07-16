import { sustainDamage } from '@/data/abilities/general/sustain-damage'
import type { Faction } from '@/types'

export const il_sai_lakoe: Faction = {
  name: 'Il Sai Lakoe, Herald of Thorns',
  system: 'TWILIGHTS_FALL',
  units: {
    FLAGSHIP: {
      BASE: {
        NAME: 'Nightbloom',
        DESCRIPTION:
          'When this unit moves, you may resolve the PRODUCTION abilities of your units in the system it started in and each system it moved through.',
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
        NAME: "Lakoe's Roots",
        DESCRIPTION:
          'When this unit is produced, place it on any planet you control.',
        COST: 2,
        COMBAT: [6, 1],
        CAPACITY_COST: 1,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
          PRODUCTION: 2,
        },
        ABILITIES: [sustainDamage],
      },
    },
  },
}
