import embersOfMuaatIcon from '@/assets/faction/embers_of_muaat.svg?raw'
import { disablePlanetaryShield } from '@/data/main/abilities/general/disable-planetary-shield'
import { sustainDamage } from '@/data/main/abilities/general/sustain-damage'
import type { Faction } from '@/types'

export const embers_of_muaat: Faction = {
  name: 'Embers of Muaat',
  icon: embersOfMuaatIcon,
  units: {
    FLAGSHIP: {
      BASE: {
        NAME: 'The Inferno',
        DESCRIPTION:
          "Action: Spend 1 token from your strategy pool to place 1 cruiser in this unit's system.",
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
        NAME: 'Ember Colossus',
        DESCRIPTION:
          'When you use your Star Forge faction ability in this system or an adjacent system, you may place 1 infantry from your reinforcements with this unit.',
        COST: 2,
        COMBAT: [6, 1],
        CAPACITY_COST: 1,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [sustainDamage],
      },
    },
    WAR_SUN: {
      BASE: {
        NAME: 'Prototype War Sun I',
        DESCRIPTION:
          'Other players units in this system lose the Planetary Shield ability.',
        FLEET_POOL_COST: 1,
        COST: 12,
        COMBAT: [3, 3],
        MOVE: 1,
        CAPACITY: 6,
        UNIT_ABILITIES: {
          BOMBARDMENT: [3, 3],
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [disablePlanetaryShield, sustainDamage],
      },
      UPGRADED: {
        NAME: 'Prototype War Sun II',
        DESCRIPTION:
          'Other players units in this system lose the Planetary Shield ability.',
        COST: 10,
        MOVE: 3,
      },
    },
  },
}
