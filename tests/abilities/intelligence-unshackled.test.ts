import { describe, expect, it } from 'vitest'

import { combatTest, unitsByBaseType } from '../utils/combat-test'

describe('TF_INTELLIGENCE_UNSHACKLED', () => {
  it('rolls against each opponent unit when your unit is destroyed', () => {
    // Attacker cruiser (combat 7) dies → Intelligence Unshackled rolls 1 die
    // against the single defender cruiser at threshold 7.
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { CRUISER: 1 },
        abilities: { TF_INTELLIGENCE_UNSHACKLED: true },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 1 } },
    })

    t.advanceToTiming(
      'BEFORE_ASSIGN_HITS',
      { attacker: 1, defender: 0 },
      'SPACE_COMBAT',
    )
    const branches = t.step()

    const byRemaining: Record<number, number> = {}
    for (const b of branches) {
      const count = unitsByBaseType(b.state.data.defender).CRUISER?.length ?? 0
      byRemaining[count] = (byRemaining[count] ?? 0) + b.probability
    }

    // die ≥ 7 → 0.4 destroys the defender cruiser; miss → 0.6 keeps it
    expect(byRemaining[0]).toBeCloseTo(0.4)
    expect(byRemaining[1]).toBeCloseTo(0.6)
  })

  it('does not split when your unit is not destroyed', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { CRUISER: 1 },
        abilities: { TF_INTELLIGENCE_UNSHACKLED: true },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 1 } },
    })

    t.advanceToTiming(
      'BEFORE_ASSIGN_HITS',
      { attacker: 0, defender: 0 },
      'SPACE_COMBAT',
    )
    const branches = t.step()

    // No own unit destroyed → Intelligence Unshackled never fires → no split.
    expect(branches).toHaveLength(1)
  })
})
