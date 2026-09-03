import { disablePlanetaryShield } from '@/data/main/abilities/general/disable-planetary-shield'
import { planetaryShield } from '@/data/main/abilities/general/planetary-shield'
import { sustainDamage } from '@/data/main/abilities/general/sustain-damage'

const baseUnits = {
  WAR_SUN: {
    BASE: {
      COST: 12,
      FLEET_POOL_COST: 1,
      COMBAT: [3, 3],
      MOVE: 2,
      CAPACITY: 6,
      UNIT_ABILITIES: {
        SUSTAIN_DAMAGE: true,
        BOMBARDMENT: [3, 3],
      },
      ABILITIES: [disablePlanetaryShield, sustainDamage],
    },
    UPGRADED: null,
  },
  CRUISER: {
    BASE: {
      COST: 2,
      FLEET_POOL_COST: 1,
      COMBAT: [7, 1],
      MOVE: 2,
      CAPACITY: null,
      UNIT_ABILITIES: {},
    },
    UPGRADED: {
      NAME: 'Cruiser II',
      COMBAT: [6, 1],
      MOVE: 3,
      CAPACITY: 1,
    },
  },
  DREADNOUGHT: {
    BASE: {
      COST: 4,
      FLEET_POOL_COST: 1,
      COMBAT: [5, 1],
      MOVE: 1,
      CAPACITY: 1,
      UNIT_ABILITIES: {
        SUSTAIN_DAMAGE: true,
        BOMBARDMENT: [5, 1],
      },
      ABILITIES: [sustainDamage],
    },
    UPGRADED: {
      NAME: 'Dreadnought II',
      MOVE: 2,
      DIRECT_HIT_IMMUNE: true,
    },
  },
  DESTROYER: {
    BASE: {
      COST: 1,
      FLEET_POOL_COST: 1,
      COMBAT: [9, 1],
      MOVE: 2,
      CAPACITY: null,
      UNIT_ABILITIES: {
        AFB: [9, 2],
      },
    },
    UPGRADED: {
      NAME: 'Destroyer II',
      COMBAT: [8, 1],
      UNIT_ABILITIES: {
        AFB: [6, 3],
      },
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
    UPGRADED: {
      NAME: 'PDS II',
      UNIT_ABILITIES: {
        SPACE_CANNON: [5, 1],
      },
    },
  },
  CARRIER: {
    BASE: {
      COST: 3,
      FLEET_POOL_COST: 1,
      COMBAT: [9, 1],
      MOVE: 1,
      CAPACITY: 4,
      UNIT_ABILITIES: {},
    },
    UPGRADED: {
      NAME: 'Carrier II',
      MOVE: 2,
      CAPACITY: 6,
    },
  },
  FIGHTER: {
    BASE: {
      COST: 0.5,
      COMBAT: [9, 1],
      MOVE: null,
      CAPACITY: null,
      CAPACITY_COST: 1,
      UNIT_ABILITIES: {},
    },
    UPGRADED: {
      NAME: 'Fighter II',
      // Keeps the BASE CAPACITY_COST: fighters fill ship capacity first and
      // only the excess counts against the fleet pool (same model as the
      // Naalu Hybrid Crystal Fighter, at full cost).
      FLEET_POOL_COST: 1,
      COMBAT: [8, 1],
      MOVE: 2,
    },
  },
  INFANTRY: {
    BASE: {
      COST: 0.5,
      COMBAT: [8, 1],
      MOVE: null,
      CAPACITY: null,
      CAPACITY_COST: 1,
      UNIT_ABILITIES: {},
    },
    UPGRADED: {
      NAME: 'Infantry II',
      COMBAT: [7, 1],
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
    UPGRADED: {
      NAME: 'Space Dock II',
    },
  },
}

export default baseUnits
