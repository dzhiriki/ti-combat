import arborecIcon from '@/assets/faction/arborec.svg?raw'
import { planetaryShield } from '@/data/main/abilities/general/planetary-shield'
import { sustainDamage } from '@/data/main/abilities/general/sustain-damage'
import type { Faction } from '@/types'

export const arborec: Faction = {
  name: 'Arborec',
  icon: arborecIcon,
  units: {
    FLAGSHIP: {
      BASE: {
        NAME: 'Duha Menaimon',
        DESCRIPTION:
          'After you activate this system, you may produce up to 5 units in this system.',
        FLEET_POOL_COST: 1,
        COST: 8,
        COMBAT: [7, 2],
        MOVE: 1,
        CAPACITY: 5,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [sustainDamage],
      },
    },
    MECH: {
      BASE: {
        NAME: 'Letani Behemoth',
        DESCRIPTION:
          'Deploy: When you would use your Mitosis faction ability, you may replace 1 of your infantry with 1 mech from your reinforcements instead.',
        COST: 2,
        COMBAT: [6, 1],
        CAPACITY_COST: 1,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
          PRODUCTION: 2,
          PLANETARY_SHIELD: true,
        },
        ABILITIES: [planetaryShield, sustainDamage],
      },
    },
    INFANTRY: {
      BASE: {
        NAME: 'Letani Warrior I',
        COST: 0.5,
        COMBAT: [8, 1],
        CAPACITY_COST: 1,
        UNIT_ABILITIES: {
          PRODUCTION: 1,
        },
      },
      UPGRADED: {
        NAME: 'Letani Warrior II',
        DESCRIPTION:
          'After this unit is destroyed, roll 1 die. If the result is 6 or greater, place the unit on this card. At the start of your next turn, place each unit that is on this card on a planet you control in your home system.',
        COMBAT: [7, 1],
        UNIT_ABILITIES: {
          PRODUCTION: 2,
        },
      },
    },
  },
}
