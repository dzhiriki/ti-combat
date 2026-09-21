import { describe, expect, it } from 'vitest'

import { all, currentUses, pendingHits, unitCount } from '../utils/branches'
import { combatTest } from '../utils/combat-test'

describe('CROWN_OF_THALNOS + HEART_OF_IXTH', () => {
  it.fails("Heart's flip on a Crown-rerolled die converts miss → hit and prevents destruction", () => {
    // 1 attacker cruiser [7,1] with both CROWN_OF_THALNOS (selecting
    // CRUISER, safeReroll OFF — destruction on rerolled-and-missed) AND
    // HEART_OF_IXTH (target='own', 1 use, +1 conditional flip).
    //
    // Crown's `shouldReroll` predicate is `!isNaturalHit`, so faces 1-6 are
    // ALL rerolled — including face 6 (flip+ eligible for Heart at base
    // hitValue 7). Only natural hits (faces 7-10) skip the reroll.
    //
    // Reroll modifier=+1 shifts the rerolled die's effective hitValue to 6.
    // At shifted hitValue=6 with Heart's amount=+1 mod:
    //   naturalHit: faces 6-10  (5/10 = 0.5)
    //   flipEligible+: face 5   (1/10 = 0.1)  — Heart flips
    //   definiteMiss: faces 1-4 (4/10 = 0.4)
    //
    // Crown's destroy effect reads per-unit hits AFTER conditional
    // modifiers commit, so a Heart-flipped face counts as a hit and the
    // unit isn't destroyed.
    //
    //   initial natural hit (0.4):        defHits=1, alive,    use=1
    //   reroll → natural hit (0.6 * 0.5): defHits=1, alive,    use=1
    //   reroll → Heart flip  (0.6 * 0.1): defHits=1, alive,    use=0
    //   reroll → miss        (0.6 * 0.4): defHits=0, destroyed,use=1
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: {
          CROWN_OF_THALNOS: {
            isEnabled: true,
            safeReroll: false,
            selectedUnitTypes: [['CRUISER', true]],
          },
          HEART_OF_IXTH: { isEnabled: true, uses: 1, target: 'own' },
        },
      },
      defender: { faction: 'ARBOREC', units: { CARRIER: 1 } },
    })

    const branches = t.advance()

    expect(branches).toHaveBranches(
      all(
        unitCount('attacker', 'CRUISER'),
        pendingHits('defender'),
        currentUses('attacker', 'HEART_OF_IXTH'),
      ),
      [
        { value: [1, 1, 1], probability: 0.7 },
        { value: [1, 1, 0], probability: 0.06 },
        { value: [0, 0, 1], probability: 0.24 },
      ],
    )
  })
})
