import { describe, expect, it } from 'vitest'

import { all, currentUses, pendingHits } from '../utils/branches'
import { combatTest } from '../utils/combat-test'

// Ordering: Crown of Thalnos is a CUSTOM_ROLL — its safe +1 reroll is baked
// into the mech's initial dice PMF — and Bone Picked Clean is a REROLL pass
// applied afterwards. So the Crown rerolls first, then an infantry is spent
// to reroll whatever still missed (at the natural value, no +1) — each die
// rerolled once per ability.
describe('TF_BONE_PICKED_CLEAN + CROWN_OF_THALNOS', () => {
  it('Crown rerolls first (+1), Bone Picked Clean rerolls the leftovers', () => {
    // Mech [5,2] under Crown's safe transform (p=.6, rerolls at .7 when ≥1
    // natural hit): P(2)=.696, P(1)=.144, P(0)=.16.
    // BPC then rerolls remaining misses at the natural .6:
    //   P(2) = .696 + .144·.6 + .16·.36 = .84
    //   P(1) = .144·.4 + .16·.48       = .1344
    //   P(0) = .16·.16                 = .0256
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'SICKENING_LURCH',
        units: { MECH: 1 },
        abilities: {
          CROWN_OF_THALNOS: { isEnabled: true },
          TF_BONE_PICKED_CLEAN: { isEnabled: true, uses: 1 },
        },
      },
      defender: { faction: 'AVARICE_REX', units: { INFANTRY: 5 } },
    })

    const branches = t.advance()

    expect(branches).toHaveBranches(
      all(
        pendingHits('defender'),
        currentUses('attacker', 'TF_BONE_PICKED_CLEAN'),
      ),
      [
        { value: [2, 1], probability: 0.696 },
        { value: [2, 0], probability: 0.144 },
        { value: [1, 0], probability: 0.1344 },
        { value: [0, 0], probability: 0.0256 },
      ],
    )
  })
})
