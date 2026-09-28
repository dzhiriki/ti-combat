import { describe, expect, it } from 'vitest'

import { makeUnitLocator } from '@/combat'
import { CombatSetup } from '@/hooks/combat-setup'
import { DEFAULT_PLANET_ID } from '@/types'

import { combatTest } from '../utils/combat-test'
import { hitOrderUnits, setAbility } from '../utils/setup-options'

describe.forEachSide('Alarum', () => {
  it('adds infantry at the end of a ground combat round', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'RAL_NEL',
        units: { MECH: 1, INFANTRY: 1 },
        abilities: {
          ALARUM: { isEnabled: true, availableUnits: [['INFANTRY', 4]] },
        },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 2 } },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound()

    // Should add 2 infantry (min of 2 and 4 available)
    expect(t.attacker.units.INFANTRY).toHaveLength(3)

    // Verify newly added infantry participates in next round dice
    t.advanceRound()
    const pool = t.dicePool()
    expect(pool.attacker).toContainDice('INFANTRY', [8, 1])
    expect(pool.attacker.INFANTRY).toHaveLength(3)
  })

  it('adds only available infantry when less than 2', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'RAL_NEL',
        units: { MECH: 1, INFANTRY: 1 },
        abilities: {
          ALARUM: { isEnabled: true, availableUnits: [['INFANTRY', 1]] },
        },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 2 } },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound()

    expect(t.attacker.units.INFANTRY).toHaveLength(2)
  })

  it('does not add infantry when none available', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'RAL_NEL',
        units: { MECH: 1, INFANTRY: 1 },
        abilities: {
          ALARUM: { isEnabled: true, availableUnits: [['INFANTRY', 0]] },
        },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 2 } },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound()

    expect(t.attacker.units.INFANTRY).toHaveLength(1)
  })

  it('decrements available infantry after each round', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'RAL_NEL',
        units: { MECH: 1, INFANTRY: 1 },
        abilities: {
          ALARUM: { isEnabled: true, availableUnits: [['INFANTRY', 3]] },
        },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 4 } },
    })

    t.advanceTo('GROUND_COMBAT')

    // First round: adds 2, leaves 1 available
    t.advanceRound()
    expect(t.attacker.units.INFANTRY).toHaveLength(3)

    // Second round: adds 1 (only 1 left), leaves 0 available
    t.advanceRound()
    expect(t.attacker.units.INFANTRY).toHaveLength(4)

    // Third round: no more available
    t.advanceRound()
    expect(t.attacker.units.INFANTRY).toHaveLength(4)
  })

  it('each mech adds 2 infantry independently', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'RAL_NEL',
        units: { MECH: 2, INFANTRY: 1 },
        abilities: {
          ALARUM: { isEnabled: true, availableUnits: [['INFANTRY', 6]] },
        },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 6 } },
    })

    t.advanceTo('GROUND_COMBAT')

    // 2 mechs each add 2 infantry, counter decreases by 4
    t.advanceRound()
    expect(t.attacker.units.INFANTRY).toHaveLength(5)

    // 2 remaining: each mech wants 2 but only 2 left total
    // First mech adds 2, counter hits 0, second mech can't fire
    t.advanceRound()
    expect(t.attacker.units.INFANTRY).toHaveLength(7)

    // No more available
    t.advanceRound()
    expect(t.attacker.units.INFANTRY).toHaveLength(7)
  })

  it('places galvanized variants when the variant is picked', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'RAL_NEL',
        units: { MECH: 1, INFANTRY: 1 },
        abilities: {
          // PRE_GALVANIZED must be enabled so the Galvanized subtype is
          // declared on INFANTRY and the variant key is valid.
          PRE_GALVANIZED: {
            isEnabled: true,
            galvanizedUnits: [['INFANTRY', 0]],
          },
          ALARUM: {
            isEnabled: true,
            availableUnits: [['INFANTRY:Galvanized', 2]],
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 2 } },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound()

    expect(t.attacker.units.INFANTRY).toHaveLength(3)
    const galvanized = t.attacker.units.INFANTRY!.filter(u =>
      u.subtypes?.includes('Galvanized'),
    )
    expect(galvanized).toHaveLength(2)
  })

  it('does not fire newly-placed mechs in the same end of round', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'RAL_NEL',
        units: { MECH: 1, INFANTRY: 1 },
        abilities: {
          // EXTRA clamps the pool to UNIT_LIMITS.MECH - 1 in-combat = 3.
          // Starting Mech places 2 (pool → 1). If a newly-placed Mech also
          // fired, it would consume the remaining 1 (pool → 0).
          ALARUM: { isEnabled: true, availableUnits: [['MECH', 4]] },
        },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 4 } },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound()

    // Starting Mech placed up to 2 new Mechs. Newly-placed Mechs must NOT
    // fire their own Alarum this round.
    expect(t.attacker.units.MECH).toHaveLength(3) // 1 starting + 2 placed
    const remaining = t.state.attacker.abilities.ALARUM!
      .availableUnits as Array<[string, number]>
    const mechRemaining = remaining.find(([k]) => k === 'MECH')?.[1]
    expect(mechRemaining).toBe(1) // 3 - 2 = 1; if double-firing happened, would be 0
  })

  it('declares the available units for the hit order', () => {
    const setup = new CombatSetup()
    setup.setFaction('attacker', 'RAL_NEL')
    setup.setCombatMode('GROUND')
    setup.setUnitCount('attacker', 'INFANTRY', 1)
    const mech = makeUnitLocator('MECH', DEFAULT_PLANET_ID)
    setAbility(setup, 'attacker', 'ALARUM', { isEnabled: true })
    expect(hitOrderUnits(setup, 'GROUND')).not.toContain(mech)

    setAbility(setup, 'attacker', 'ALARUM', { availableUnits: [['MECH', 2]] })
    expect(hitOrderUnits(setup, 'GROUND')).toContain(mech)
  })
})
