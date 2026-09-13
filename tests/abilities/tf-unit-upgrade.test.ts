import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('TF unit upgrades', () => {
  it('applies a non-mech upgrade to the unit stats (Hybrid Crystal Fighter)', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { FIGHTER: 1 },
        abilities: { TF_UPGRADE_HYBRID_CRYSTAL_FIGHTER: true },
      },
      defender: { faction: 'AVARICE_REX', units: { FIGHTER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    // Base fighter combat 9 → upgraded to 7
    expect(t.dicePool().attacker).toContainDice('FIGHTER', [7, 1])
  })

  it('Morphwing fighters in excess of capacity count against the fleet pool', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        // Cruiser has no capacity — base fighters would be removed. With
        // Morphwing all 4 are in excess, each costing 1 fleet pool:
        // cruiser 1 + 4 fighters = 5 > 4 → one fighter removed.
        units: { CRUISER: 1, FIGHTER: 4 },
        abilities: {
          TF_UPGRADE_MORPHWING: true,
          CAPACITY: true,
          FLEET_POOL: {
            isEnabled: true,
            fleetPool: 4,
            shipPriority: [['CRUISER'], ['FIGHTER']],
          },
        },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    expect(t.attacker.units.CRUISER).toHaveLength(1)
    expect(t.attacker.units.FIGHTER).toHaveLength(3)
  })

  it('Morphwing fighters within ship capacity cost no fleet pool', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        // Carrier (cap 4) absorbs all 4 fighters — none in excess, so only
        // the carrier's own 1 counts: 1 ≤ 1 → everything survives.
        units: { CARRIER: 1, FIGHTER: 4 },
        abilities: {
          TF_UPGRADE_MORPHWING: true,
          CAPACITY: true,
          FLEET_POOL: {
            isEnabled: true,
            fleetPool: 1,
            shipPriority: [['CARRIER'], ['FIGHTER']],
          },
        },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    expect(t.attacker.units.CARRIER).toHaveLength(1)
    expect(t.attacker.units.FIGHTER).toHaveLength(4)
  })

  it('Morphwing fighters may commit to ground combat', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'GROUND',
      attacker: {
        faction: 'AVARICE_REX',
        units: { FIGHTER: 2, INFANTRY: 1 },
        abilities: { TF_UPGRADE_MORPHWING: true },
      },
      defender: { faction: 'AVARICE_REX', units: { INFANTRY: 1 } },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound()

    expect(t.dicePool().attacker).toContainDice('FIGHTER', [7, 1])
  })

  it('Morphwing fighters are hit targets once committed, after infantry', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'GROUND',
      attacker: {
        faction: 'AVARICE_REX',
        units: { FIGHTER: 2, INFANTRY: 2 },
        abilities: { TF_UPGRADE_MORPHWING: true },
      },
      defender: { faction: 'AVARICE_REX', units: { INFANTRY: 3 } },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound({ attacker: 3 })

    expect(t.attacker.units.INFANTRY).toBeUndefined()
    expect(t.attacker.units.FIGHTER).toHaveLength(1)
  })

  it('Morphwing does not let the defender commit fighters', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'GROUND',
      attacker: { faction: 'AVARICE_REX', units: { INFANTRY: 1 } },
      defender: {
        faction: 'AVARICE_REX',
        units: { FIGHTER: 2, INFANTRY: 1 },
        abilities: { TF_UPGRADE_MORPHWING: true },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound()

    expect(t.dicePool()?.defender?.FIGHTER).toBeUndefined()
  })

  it('Hybrid Crystal Fighters fill capacity first, excess at half a fleet pool', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        // Carrier (cap 4) + 8 HCF: 4 fit in capacity, 4 excess × 0.5 = 2.
        // Fleet pool: carrier 1 + 2 = 3 ≤ 3 → everything survives.
        units: { CARRIER: 1, FIGHTER: 8 },
        abilities: {
          TF_UPGRADE_HYBRID_CRYSTAL_FIGHTER: true,
          CAPACITY: true,
          FLEET_POOL: {
            isEnabled: true,
            fleetPool: 3,
            shipPriority: [['CARRIER'], ['FIGHTER']],
          },
        },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    expect(t.attacker.units.CARRIER).toHaveLength(1)
    expect(t.attacker.units.FIGHTER).toHaveLength(8)
  })

  it('Hybrid Crystal Fighters riding free on A Strangled Whisper cost no fleet pool', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'SICKENING_LURCH',
        // The flagship carries any number of fighters free — none are in
        // excess of capacity, so none spill into the fleet pool: flagship 1
        // ≤ 2. Without the FREE_CARGO exemption the 6 HCF would overflow
        // the flagship's capacity of 1 and blow the pool.
        units: { FLAGSHIP: 1, FIGHTER: 6 },
        abilities: {
          TF_UPGRADE_HYBRID_CRYSTAL_FIGHTER: true,
          CAPACITY: true,
          FLEET_POOL: {
            isEnabled: true,
            fleetPool: 2,
            shipPriority: [['FLAGSHIP'], ['FIGHTER']],
          },
        },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    expect(t.attacker.units.FLAGSHIP).toHaveLength(1)
    expect(t.attacker.units.FIGHTER).toHaveLength(6)
  })

  it('Echo of Ascension adjusts the flagship relative to its faction stats', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { FLAGSHIP: 1 },
        abilities: { TF_UPGRADE_ECHO_OF_ASCENSION: true },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    // Scintillia base [9,2] → combat value -1 and +1 die → [8,3]
    expect(t.dicePool().attacker).toContainDice('FLAGSHIP', [8, 3])
  })

  it('grants Sustain Damage via the Advanced Carrier upgrade', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { CARRIER: 1 },
        abilities: { TF_UPGRADE_ADVANCED_CARRIER: true },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 1 })

    // Base carriers can't sustain; the upgrade lets it survive 1 hit as damaged
    expect(t.attacker.units.CARRIER).toHaveLength(1)
    expect(t.attacker.units.CARRIER?.[0].isDamaged).toBe(true)
  })

  it('stacks mech upgrades (Eidolon Landwaster +1 die, then Eidolon Terminus -1 combat)', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'GROUND',
      attacker: {
        faction: 'AVARICE_REX',
        units: { MECH: 1 },
        abilities: {
          TF_UPGRADE_EIDOLON_LANDWASTER: true,
          TF_UPGRADE_EIDOLON_TERMINUS: true,
        },
      },
      defender: { faction: 'AVARICE_REX', units: { INFANTRY: 1 } },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound()

    // Delver mech base [6,1] → +1 die → [6,2] → -1 combat value → [5,2]
    expect(t.dicePool().attacker).toContainDice('MECH', [5, 2])
  })
})
