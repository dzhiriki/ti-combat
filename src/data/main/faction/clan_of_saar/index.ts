import clanOfSaarIcon from '@/assets/faction/clan_of_saar.svg?raw'
import { sustainDamage } from '@/data/main/abilities/general/sustain-damage'
import type { Faction } from '@/types'

export const clan_of_saar: Faction = {
  name: 'Clan of Saar',
  icon: clanOfSaarIcon,
  units: {
    FLAGSHIP: {
      BASE: {
        NAME: 'Son of Ragh',
        FLEET_POOL_COST: 1,
        COST: 8,
        COMBAT: [5, 2],
        MOVE: 1,
        CAPACITY: 3,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
          AFB: [6, 4],
        },
        ABILITIES: [sustainDamage],
      },
    },
    MECH: {
      BASE: {
        NAME: 'Scavenger Zeta',
        DESCRIPTION:
          'Deploy: After you gain control of a planet, you may spend 1 trade good to place 1 mech on that planet.',
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
        NAME: 'Floating Factory I',
        DESCRIPTION:
          'This unit is placed in a space area instead of on a planet. This unit can move and retreat as if it were a ship. If this unit is blockaded, it is destroyed.',
        MOVE: 1,
        ALLOWED_SURFACES: ['SPACE'],
        CAPACITY: 4,
        UNIT_ABILITIES: {
          PRODUCTION: 5,
        },
      },
      UPGRADED: {
        NAME: 'Floating Factory II',
        DESCRIPTION:
          'This unit is placed in a space area instead of on a planet. This unit can move and retreat as if it were a ship. If this unit is blockaded, it is destroyed.',
        MOVE: 2,
        ALLOWED_SURFACES: ['SPACE'],
        CAPACITY: 5,
        UNIT_ABILITIES: {
          PRODUCTION: 7,
        },
      },
    },
  },
}
