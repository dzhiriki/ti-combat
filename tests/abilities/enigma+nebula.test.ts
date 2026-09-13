import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

// NEBULA is defender-side restricted, so no forEachSide here.
describe('TF_ENIGMA + NEBULA', () => {
  it('the flagship ignores the nebula +1 while other defenders keep it', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: { faction: 'AVARICE_REX', units: { CRUISER: 1 } },
      defender: {
        faction: 'IL_NA_VIROSET',
        units: { FLAGSHIP: 1, CRUISER: 1 },
        abilities: { NEBULA: true },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()
    const pool = t.dicePool()

    // Cruiser: 7 - 1 (nebula) = 6; Enigma ignores the anomaly and stays 7.
    expect(pool.defender).toContainDice('CRUISER', [6, 1])
    expect(pool.defender).toContainDice('FLAGSHIP', [7, 1])
  })

  it('does nothing when the Il Na Viroset side is the attacker', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: { faction: 'IL_NA_VIROSET', units: { FLAGSHIP: 1 } },
      defender: {
        faction: 'AVARICE_REX',
        units: { CRUISER: 1 },
        abilities: { NEBULA: true },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()
    const pool = t.dicePool()

    // The attacking flagship rolls its printed 7 (no stray -1), and the
    // defender keeps the nebula bonus.
    expect(pool.attacker).toContainDice('FLAGSHIP', [7, 1])
    expect(pool.defender).toContainDice('CRUISER', [6, 1])
  })
})
