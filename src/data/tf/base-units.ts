import { planetaryShield } from '@/data/main/abilities/general/planetary-shield'
import { sustainDamage } from '@/data/main/abilities/general/sustain-damage'
import type { UnitBaseType, UnitDefinition } from '@/types'

// Generic unit roster for Twilight's Fall. Stats mirror the base TI4 units,
// with two differences:
//   1. War Suns are part of the default roster (any faction can field them)
//      rather than being gated behind a faction like the Embers of Muaat.
//   2. There are no generic unit upgrades (Cruiser II, etc.). Twilight's Fall
//      uses a separate deck of unit-upgrade cards, so no unit declares an
//      UPGRADED block; upgrades are layered in separately.
// Flagships and mechs are faction-specific, so the generic roster has none.
const tfBaseUnits: Partial<Record<UnitBaseType, UnitDefinition>> = {
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
      ABILITIES: [sustainDamage],
    },
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
  CARRIER: {
    BASE: {
      COST: 3,
      FLEET_POOL_COST: 1,
      COMBAT: [9, 1],
      MOVE: 1,
      CAPACITY: 4,
      UNIT_ABILITIES: {},
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
}

export default tfBaseUnits
