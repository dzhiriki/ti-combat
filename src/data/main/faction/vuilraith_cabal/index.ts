import vuilraithCabalIcon from '@/assets/faction/vuilraith_cabal.svg?raw'
import { sustainDamage } from '@/data/main/abilities/general/sustain-damage'
import type { Faction } from '@/types'

export const vuilraith_cabal: Faction = {
  name: "Vuil'raith Cabal",
  icon: vuilraithCabalIcon,
  units: {
    FLAGSHIP: {
      BASE: {
        NAME: 'The Terror Between',
        DESCRIPTION:
          'Capture all other non-structure units that are destroyed in this system, including your own.',
        FLEET_POOL_COST: 1,
        COST: 8,
        COMBAT: [5, 2],
        MOVE: 1,
        CAPACITY: 3,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
          BOMBARDMENT: [5, 1],
        },
        ABILITIES: [sustainDamage],
      },
    },
    MECH: {
      BASE: {
        NAME: 'Reanimator',
        DESCRIPTION:
          'When your infantry on this planet are destroyed, place them on your faction sheet; those units are captured.',
        COST: 2,
        COMBAT: [6, 1],
        CAPACITY_COST: 1,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [sustainDamage],
      },
    },
    SPACE_DOCK: {
      BASE: {
        NAME: 'Dimensional Tear I',
        DESCRIPTION:
          "This system is a gravity rift; your ships do not roll for this gravity rift. Place a dimensional tear token beneath this unit as a reminder. Up to 6 fighters in this system do not count against your ships' capacity.",
        UNIT_ABILITIES: {
          PRODUCTION: 5,
        },
      },
      UPGRADED: {
        NAME: 'Dimensional Tear II',
        DESCRIPTION:
          "This system is a gravity rift; your ships do not roll for this gravity rift. Place a dimensional tear token beneath this unit as a reminder. Up to 12 fighters in this system do not count against your ships' capacity.",
        UNIT_ABILITIES: {
          PRODUCTION: 7,
        },
      },
    },
  },
}
