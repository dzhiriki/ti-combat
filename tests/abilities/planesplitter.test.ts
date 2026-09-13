import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('TF_PLANESPLITTER', () => {
  it('applies +2 to own combat rolls', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { CRUISER: 1 },
        abilities: { TF_PLANESPLITTER: true },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()
    const pool = t.dicePool()

    // Cruiser: 7 - 2 (Planesplitter) = 5; opponent unaffected.
    expect(pool.attacker).toContainDice('CRUISER', [5, 1])
    expect(pool.defender).toContainDice('CRUISER', [7, 1])
  })

  it('does not touch unit-ability rolls', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { DESTROYER: 1 },
        abilities: { TF_PLANESPLITTER: true },
      },
      defender: { faction: 'AVARICE_REX', units: { FIGHTER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    // AFB pool is logged first (round 1): the barrage keeps its printed 9.
    expect(t.dicePool(0).attacker).toContainDice('DESTROYER', [9, 2])
    // The combat roll itself gets the +2 (9 → 7).
    expect(t.dicePool().attacker).toContainDice('DESTROYER', [7, 1])
  })
})
