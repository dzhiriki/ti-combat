import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('TF_DIVINITY + TF_SPARK', () => {
  it('saves the sustaining ship from Spark in space combat', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { CRUISER: 1 },
        abilities: { TF_SPARK: { uses: 1 } },
      },
      defender: {
        faction: 'AVARICE_REX',
        units: { DREADNOUGHT: 1 },
        abilities: { TF_DIVINITY: true },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ defender: 1 })

    // Dreadnought sustained the hit (proving Spark triggered), then Divinity
    // countered Spark's direct destroy — the ship survives, damaged.
    expect(t.defender.units.DREADNOUGHT).toHaveLength(1)
    expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBe(true)
    expect(t.abilityLog('TF_DIVINITY')).not.toHaveLength(0)
  })

  it('does not save the ship once the card is spent', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { CRUISER: 1 },
        abilities: { TF_SPARK: { uses: 1 } },
      },
      defender: {
        faction: 'AVARICE_REX',
        units: { DREADNOUGHT: 1 },
        abilities: { TF_DIVINITY: { isEnabled: true, uses: 0 } },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ defender: 1 })

    // Sustain fired, Spark destroyed the ship — no use left to prevent it.
    expect(t.defender.units.DREADNOUGHT).toBeUndefined()
    expect(t.abilityLog('TF_DIVINITY')).toHaveLength(0)
  })

  it('saves the sustaining mech from Spark in ground combat', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'AVARICE_REX',
        units: { INFANTRY: 4 },
        abilities: { TF_SPARK: { uses: 1 } },
      },
      defender: {
        faction: 'AVARICE_REX',
        units: { MECH: 1 },
        abilities: { TF_DIVINITY: true },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound({ defender: 1 })

    expect(t.defender.units.MECH).toHaveLength(1)
    expect(t.defender.units.MECH![0].isDamaged).toBe(true)
    expect(t.abilityLog('TF_DIVINITY')).not.toHaveLength(0)
  })
})
