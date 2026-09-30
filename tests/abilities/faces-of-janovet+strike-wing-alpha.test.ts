import { describe, expect, it } from 'vitest'

import { unitCount } from '../utils/branches'
import { combatTest } from '../utils/combat-test'

// The Faces of Janovet copies the Strike Wing Alpha text onto the flagship:
// each natural 9/10 on its own AFB dice also destroys an opponent infantry.
// The ability log skips dice-roll triggers, so the infantry losses show the
// text fired.
describe('TF_FACES_OF_JANOVET + TF_UPGRADE_STRIKE_WING_ALPHA', () => {
  function janovetAfb(card: string, units: Record<string, number>) {
    return combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'EL_NEN_JANOVET',
        units,
        abilities: { [card]: true },
      },
      defender: {
        faction: 'AVARICE_REX',
        units: { CARRIER: 1, FIGHTER: 1, INFANTRY: 3 },
      },
    })
  }

  it("the flagship's AFB naturals 9/10 destroy infantry", () => {
    // Flagship AFB [6,3] → 3 dice, P(natural 9/10) = 0.2 each.
    const afbBranches = janovetAfb('TF_UPGRADE_STRIKE_WING_ALPHA', {
      FLAGSHIP: 1,
    }).advance()

    expect(afbBranches).toHaveBranches(unitCount('defender', 'INFANTRY'), [
      { value: 3, probability: 0.512 },
      { value: 2, probability: 0.384 },
      { value: 1, probability: 0.096 },
      { value: 0, probability: 0.008 },
    ])
  })

  it('the flagship and a Strike Wing Alpha destroyer both trigger', () => {
    // 6 AFB dice: P(k naturals) = C(6,k)·0.2^k·0.8^(6−k); 3 infantry cap it.
    const afbBranches = janovetAfb('TF_UPGRADE_STRIKE_WING_ALPHA', {
      FLAGSHIP: 1,
      DESTROYER: 1,
    }).advance()

    expect(afbBranches).toHaveBranches(unitCount('defender', 'INFANTRY'), [
      { value: 3, probability: 0.262144 },
      { value: 2, probability: 0.393216 },
      { value: 1, probability: 0.24576 },
      { value: 0, probability: 0.09888 },
    ])
  })

  it('the same AFB without the text destroys no infantry', () => {
    // Exile grants the flagship the same AFB [6,3] but no text.
    const afbBranches = janovetAfb('TF_UPGRADE_EXILE', {
      FLAGSHIP: 1,
    }).advance()

    expect(afbBranches).toHaveBranches(unitCount('defender', 'INFANTRY'), [
      { value: 3, probability: 1 },
    ])
  })
})
