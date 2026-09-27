import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('ASSIMILATOR_Z + MATRIARCH', () => {
  it('fighters participate in ground combat when Nekro flagship is present', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1, FIGHTER: 2, INFANTRY: 1 },
        abilities: { NEKRO_FLAGSHIP_MATRIARCH: true },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 1 } },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound()
    const pool = t.dicePool()

    // Nekro fighters: base [9, 1]
    expect(pool.attacker).toContainDice('FIGHTER', [9, 1])
  })
})
