import { disablePlanetaryShield } from '@/data/abilities/general/disable-planetary-shield'
import { planetaryShield } from '@/data/abilities/general/planetary-shield'
import { sustainDamage } from '@/data/abilities/general/sustain-damage'

// Generic unit roster for Twilight's Fall. Stats mirror the base TI4 units,
// with two differences:
//   1. War Suns are part of the default roster (any faction can field them)
//      rather than being gated behind a faction like the Embers of Muaat.
//   2. There are no generic unit upgrades (Cruiser II, etc.). Twilight's Fall
//      uses a separate deck of unit-upgrade cards, so every UPGRADED slot is
//      null here; upgrades are layered in separately.
const tfBaseUnits = {
  WAR_SUN: {
    BASE: {
      COST: 12,
      FLEET_POOL_COST: 1,
      COMBAT: [5, 2],
      MOVE: 0,
      CAPACITY: 6,
      UNIT_ABILITIES: {
        SUSTAIN_DAMAGE: true,
        BOMBARDMENT: [5, 3],
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
    UPGRADED: null,
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
    UPGRADED: null,
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
    UPGRADED: null,
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
    UPGRADED: null,
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
    UPGRADED: null,
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
    UPGRADED: null,
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
    UPGRADED: null,
  },
  SPACE_DOCK: {
    BASE: {
      COST: null,
      COMBAT: null,
      MOVE: null,
      CAPACITY: null,
      UNIT_ABILITIES: {},
    },
    UPGRADED: null,
  },
}

export default tfBaseUnits
