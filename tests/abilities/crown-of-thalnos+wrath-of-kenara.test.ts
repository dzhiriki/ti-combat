import { describe, expect, it } from 'vitest'

import { all, currentUses, pendingHits, unitCount } from '../utils/branches'
import { combatTest } from '../utils/combat-test'

describe('CROWN_OF_THALNOS + WRATH_OF_KENARA', () => {
  it.fails("Kenara's flip on a Crown-rerolled die converts miss → hit and prevents destruction", () => {
    // Hacan FLAGSHIP [7,2] with both CROWN_OF_THALNOS (selecting FLAGSHIP,
    // safeReroll OFF — destruction on rerolled-and-missed) AND
    // WRATH_OF_KENARA (1 use, +1 conditional flip on own dice). Kenara is a
    // flagship ability — needs a flagship to register.
    //
    // Each flagship die is independent; per-die final classes:
    //   NH = initial natural hit (face 7-10): 0.4              hit
    //   RH = rerolled, post-roll natural hit at shifted hv=6:  0.6 * 0.5 = 0.3   hit
    //   RF = rerolled, post-roll flip+ (face 5):               0.6 * 0.1 = 0.06  hit iff Kenara consumed
    //   RM = rerolled, post-roll definite miss (1-4):          0.6 * 0.4 = 0.24  miss
    //
    // Crown's destroy fires on rerolled units with 0 hits. Kenara's
    // shared single use flips ONE RF die across the unit's 2 dice. After
    // post-roll, Kenara's use is consumed iff at least one die is RF.
    //
    // Joint (d1, d2) → (alive, attHits, kenara_uses):
    //   destroy only happens at (RM, RM): 0.0576
    //   Kenara consumed iff at least one die is RF: 0.06*2 - 0.06*0.06 = 0.1164
    //
    // Aggregated:
    //   (1, 2, 1): NH/RH × NH/RH = 0.7^2 = 0.49
    //   (1, 2, 0): one RF flipped to hit + the other is NH/RH = 2 * 0.06 * 0.7 = 0.084
    //   (1, 1, 1): one NH/RH + one RM, no RF        = 2 * 0.7 * 0.24 = 0.336
    //   (1, 1, 0): one RF flipped + one RM, OR two RF (one flipped, one stays miss)
    //              = 2 * 0.06 * 0.24 + 0.06^2 = 0.0288 + 0.0036 = 0.0324
    //   (0, 0, 1): two RM (both miss, destroy fires) = 0.24^2 = 0.0576
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'EMIRATES_OF_HACAN',
        units: { FLAGSHIP: 1 },
        abilities: {
          CROWN_OF_THALNOS: {
            isEnabled: true,
            safeReroll: false,
            selectedUnitTypes: [['FLAGSHIP', true]],
          },
          WRATH_OF_KENARA: { uses: 1 },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 4 } },
    })

    const branches = t.advance()

    expect(branches).toHaveBranches(
      all(
        unitCount('attacker', 'FLAGSHIP'),
        pendingHits('defender'),
        currentUses('attacker', 'WRATH_OF_KENARA'),
      ),
      [
        { value: [1, 2, 1], probability: 0.49 },
        { value: [1, 2, 0], probability: 0.084 },
        { value: [1, 1, 1], probability: 0.336 },
        { value: [1, 1, 0], probability: 0.0324 },
        { value: [0, 0, 1], probability: 0.0576 },
      ],
    )
  })
})
