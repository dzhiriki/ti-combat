import { disablePlanetaryShield } from '@/data/main/abilities/general/disable-planetary-shield'
import { planetaryShield } from '@/data/main/abilities/general/planetary-shield'
import { sustainDamage } from '@/data/main/abilities/general/sustain-damage'
import type { Faction } from '@/types'

export const neutral: Faction = {
  name: 'Neutral',
  units: {
    FLAGSHIP: {
      BASE: {
        FLEET_POOL_COST: 1,
        COST: 8,
        COMBAT: [7, 2],
        MOVE: 1,
        CAPACITY: 3,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [sustainDamage],
      },
    },
    WAR_SUN: {
      BASE: {
        FLEET_POOL_COST: 1,
        COST: 12,
        COMBAT: [3, 3],
        MOVE: 2,
        CAPACITY: 6,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
          BOMBARDMENT: [3, 3],
        },
        ABILITIES: [disablePlanetaryShield, sustainDamage],
      },
    },
    DREADNOUGHT: {
      BASE: {
        FLEET_POOL_COST: 1,
        COST: 4,
        COMBAT: [5, 1],
        MOVE: 2,
        CAPACITY: 1,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
          BOMBARDMENT: [5, 1],
        },
        ABILITIES: [sustainDamage],
      },
    },
    CARRIER: {
      BASE: {
        FLEET_POOL_COST: 1,
        COST: 3,
        COMBAT: [9, 1],
        MOVE: 2,
        CAPACITY: 6,
        UNIT_ABILITIES: {},
      },
    },
    CRUISER: {
      BASE: {
        FLEET_POOL_COST: 1,
        COST: 2,
        COMBAT: [6, 1],
        MOVE: 3,
        CAPACITY: 1,
        UNIT_ABILITIES: {},
      },
    },
    DESTROYER: {
      BASE: {
        FLEET_POOL_COST: 1,
        COST: 1,
        COMBAT: [8, 1],
        MOVE: 2,
        CAPACITY: null,
        UNIT_ABILITIES: {
          AFB: [6, 3],
        },
      },
    },
    FIGHTER: {
      BASE: {
        COST: 0.5,
        COMBAT: [8, 1],
        CAPACITY_COST: 1,
        MOVE: 2,
        CAPACITY: null,
        UNIT_ABILITIES: {},
      },
    },
    MECH: {
      BASE: {
        COST: 2,
        COMBAT: [2, 1],
        CAPACITY_COST: 1,
        MOVE: null,
        CAPACITY: null,
        UNIT_ABILITIES: {
          SUSTAIN_DAMAGE: true,
        },
        ABILITIES: [sustainDamage],
      },
    },
    INFANTRY: {
      BASE: {
        COST: 0.5,
        COMBAT: [8, 1],
        CAPACITY_COST: 1,
        MOVE: null,
        CAPACITY: null,
        UNIT_ABILITIES: {},
      },
    },
    PDS: {
      BASE: {
        COST: null,
        COMBAT: null,
        MOVE: null,
        CAPACITY: null,
        UNIT_ABILITIES: {
          PLANETARY_SHIELD: true,
          SPACE_CANNON: [6, 1],
        },
        ABILITIES: [planetaryShield],
      },
    },
    SPACE_DOCK: {
      BASE: {
        COST: null,
        COMBAT: null,
        MOVE: null,
        CAPACITY: null,
        UNIT_ABILITIES: {},
      },
    },
  },
}
