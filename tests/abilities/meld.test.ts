import { describe, expect, it } from 'vitest'

import { all, pendingHits } from '../utils/branches'
import { combatTest } from '../utils/combat-test'

describe('TF_MELD', () => {
  it('melds combat dice for BOTH players', () => {
    // Cruiser combat 7, melded die = 2d10 summed, capped at 10:
    // P(hit) = 1 - (6·5)/200 = 0.85 per die, for both sides.
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { CRUISER: 1 },
        abilities: { TF_MELD: true },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    const branches = t.advance()

    // [hits attacker receives, hits defender receives]
    expect(branches).toHaveBranches(
      all(pendingHits('attacker'), pendingHits('defender')),
      [
        { value: [1, 1], probability: 0.7225 },
        { value: [1, 0], probability: 0.1275 },
        { value: [0, 1], probability: 0.1275 },
        { value: [0, 0], probability: 0.0225 },
      ],
    )
  })

  it('melds unit-ability dice, including the opponent’s Space Cannon', () => {
    // Defender PDS space cannon 6, attacker holds Meld — "any player" means
    // the opponent's unit-ability dice transform too:
    // P(hit) = 1 - (5·4)/200 = 0.9.
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { CRUISER: 2 },
        abilities: { TF_MELD: true },
      },
      defender: { faction: 'AVARICE_REX', units: { PDS: 1, CRUISER: 1 } },
    })

    // First branching point is the Space Cannon Offense roll.
    const branches = t.advance()

    expect(branches).toHaveBranches(pendingHits('attacker'), [
      { value: 1, probability: 0.9 },
      { value: 0, probability: 0.1 },
    ])
  })
})
