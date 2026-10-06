import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'
import { PLANET_1, PLANET_2, TWO_PLANET_INVASION } from '../utils/surface-units'

describe.forEachSide('FRAGILE + SHIELD_PALING', () => {
  it('prevents Fragile from affecting infantry dice', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'UNIVERSITIES_OF_JOL_NAR',
        units: { MECH: 1, INFANTRY: 2 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound()
    const pool = t.dicePool()

    // Infantry: 8 (base), Fragile excluded by Shield Paling
    expect(pool.attacker).toContainDice('INFANTRY', [8, 1])
    // Mech: 6 + 1(Fragile) = 7, still affected
    expect(pool.attacker).toContainDice('MECH', [7, 1])
  })

  it('restores Fragile to infantry when last mech is destroyed', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'UNIVERSITIES_OF_JOL_NAR',
        units: { MECH: 1, INFANTRY: 1 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    // Mech sustains
    t.advanceRound({ attacker: 1 })
    // Infantry dies (sacrifice order), then damaged mech dies
    t.advanceRound({ attacker: 2 })

    expect(t.attacker.units.MECH).toBeUndefined()
    expect(t.attacker.units.INFANTRY).toBeUndefined()

    // AFTER_DESTROY restored Fragile for infantry
    expect(t.state.attacker.abilities.FRAGILE.excludeUnits).not.toContain(
      'INFANTRY',
    )
  })

  it('does not restore Fragile while at least one mech remains', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'UNIVERSITIES_OF_JOL_NAR',
        units: { MECH: 2 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    // Both mechs sustain
    t.advanceRound({ attacker: 2 })
    // One damaged mech dies
    t.advanceRound({ attacker: 1 })

    expect(t.attacker.units.MECH).toHaveLength(1)

    // AFTER_DESTROY blocked (1 mech remains)
    expect(t.state.attacker.abilities.FRAGILE.excludeUnits).toContain(
      'INFANTRY',
    )
  })

  it('only protects infantry on the mech planet', () => {
    const t = combatTest({
      ...TWO_PLANET_INVASION,
      attacker: {
        faction: 'UNIVERSITIES_OF_JOL_NAR',
        units: {},
        placements: {
          [PLANET_1]: { MECH: 1, INFANTRY: 1 },
          [PLANET_2]: { INFANTRY: 1 },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: {},
        placements: {
          [PLANET_1]: { INFANTRY: 1 },
          [PLANET_2]: { INFANTRY: 1 },
        },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound({ defender: 1 })
    expect(t.dicePool().attacker).toContainDice('INFANTRY', [8, 1])

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound({ defender: 1 })
    expect(t.dicePool().attacker).toContainDice('INFANTRY', [9, 1])
  })
})
