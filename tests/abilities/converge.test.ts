import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('TF_CONVERGE', () => {
  it('forces Space Cannon Offense hits onto non-fighter ships', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { CRUISER: 1, FIGHTER: 2 },
      },
      defender: {
        faction: 'AVARICE_REX',
        units: { PDS: 1, CRUISER: 1 },
        abilities: { TF_CONVERGE: true },
      },
    })

    // Defender PDS fires Space Cannon; force 1 hit onto the attacker.
    t.advanceTo('AFB', { attacker: 1 })

    // Converge routes the hit to the non-fighter cruiser, sparing the fighters.
    expect(t.attacker.units.CRUISER).toBeUndefined()
    expect(t.attacker.units.FIGHTER).toHaveLength(2)
  })
})
