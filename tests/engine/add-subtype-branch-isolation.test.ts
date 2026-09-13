import { describe, expect, it } from 'vitest'

import { CombatEngine } from '@/combat/combat-engine/combat-engine'
import { buildCombatState } from '@/hooks/combat-setup/build-combat-state'

describe('addSubtype branch isolation', () => {
  it('keeps expected cruiser count bounded when Dame Briar fires inside branches', () => {
    // Repro from a user bug report: 4v3 CRUISER with Dame Briar galvanizing on
    // own destruction inflated the expected surviving cruiser count to ~18.5
    // because addSubtype mutated arrays shared across probability branches.
    const combatState = buildCombatState({
      system: 'TI4',
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 4 },
        abilities: {
          DAME_BRIAR: { isEnabled: true, spaceUnitType: 'CRUISER' },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 3 } },
    })

    const outcomes = new CombatEngine().simulate(combatState)

    let expectedCruisers = 0
    for (const out of outcomes) {
      let cruisers = 0
      for (const key of Object.keys(out.attacker)) {
        if (key === 'CRUISER' || key.startsWith('CRUISER:')) {
          cruisers += out.attacker[key]?.length ?? 0
        }
      }
      expectedCruisers += cruisers * out.probability
    }

    // Starting with 4 cruisers, the expected surviving count must not exceed 4.
    expect(expectedCruisers).toBeLessThanOrEqual(4)
  })
})
