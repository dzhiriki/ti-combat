import { describe, expect, it } from 'vitest'

import { pendingHits } from '../utils/branches'
import { combatTest } from '../utils/combat-test'

describe('TF_COLADA + CROWN_OF_THALNOS', () => {
  it("Crown's safe reroll covers Colada's die", () => {
    // Colada adds its die TO the flagship's roll, so Tizona [3,1] becomes
    // [3,2] and Crown's safe path (hit value 2, or more than 1 die per unit)
    // applies. Safe mode: p = 0.8, p' = 0.9.
    //   P(0) = 0.2^2                                  = 0.04
    //   P(1) = C(2,1)*0.8*0.2 * C(1,0)*0.1            = 0.032
    //   P(2) = C(2,1)*0.8*0.2 * 0.9  +  0.8^2         = 0.928
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'SAINT_OF_SWORDS',
        units: { FLAGSHIP: 1, MECH: 1 },
        abilities: {
          TF_COLADA: true,
          CROWN_OF_THALNOS: { isEnabled: true, safeReroll: true },
        },
      },
      defender: { faction: 'AVARICE_REX', units: { CARRIER: 1 } },
    })

    const branches = t.advance()

    expect(branches).toHaveBranches(pendingHits('defender'), [
      { value: 0, probability: 0.04 },
      { value: 1, probability: 0.032 },
      { value: 2, probability: 0.928 },
    ])
  })

  it('does not feed Crown an extra die in ground combat', () => {
    // Colada is space-only, and the mech is never a legal target anyway, so
    // it stays at [6,1] — one die per unit, which Crown's safe path leaves
    // alone. Plain 0.5/0.5.
    const t = combatTest({
      system: 'TF',
      mode: 'GROUND',
      attacker: {
        faction: 'SAINT_OF_SWORDS',
        units: { MECH: 1 },
        abilities: {
          TF_COLADA: true,
          CROWN_OF_THALNOS: { isEnabled: true, safeReroll: true },
        },
      },
      defender: { faction: 'AVARICE_REX', units: { INFANTRY: 1 } },
    })

    const branches = t.advance()

    expect(branches).toHaveBranches(pendingHits('defender'), [
      { value: 0, probability: 0.5 },
      { value: 1, probability: 0.5 },
    ])
  })
})
