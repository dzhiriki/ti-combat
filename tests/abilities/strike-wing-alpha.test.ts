import { describe, expect, it } from 'vitest'

import { unitCount } from '../utils/branches'
import { combatTest } from '../utils/combat-test'

describe('TF_UPGRADE_STRIKE_WING_ALPHA', () => {
  it('destroys 1 opponent infantry per natural 9/10 on its AFB', () => {
    // Destroyer AFB [6,3] → 3 dice. P(face 9/10) = 2/10 per die.
    //   0 naturals: 0.8^3 = 0.512 → 3 infantry remain
    //   1: 3·0.2·0.8^2 = 0.384 → 2 remain
    //   2: 3·0.04·0.8 = 0.096 → 1 remains
    //   3: 0.2^3 = 0.008 → 0 remain
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { DESTROYER: 1 },
        abilities: { TF_UPGRADE_STRIKE_WING_ALPHA: true },
      },
      defender: {
        faction: 'AVARICE_REX',
        units: { CARRIER: 1, FIGHTER: 1, INFANTRY: 3 },
      },
    })

    const afbBranches = t.advance()

    expect(afbBranches).toHaveBranches(unitCount('defender', 'INFANTRY'), [
      { value: 3, probability: 0.512 },
      { value: 2, probability: 0.384 },
      { value: 1, probability: 0.096 },
      { value: 0, probability: 0.008 },
    ])
  })
})
