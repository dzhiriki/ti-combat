import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('TECHNOLOGICAL_SINGULARITY + SUPERCHARGE', () => {
  it('Supercharge activates in round 2 after TS enables it', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { CRUISER: 3 },
        abilities: {
          TECHNOLOGICAL_SINGULARITY: {
            isEnabled: true,
            enableAbilityKey: 'NEKRO_SUPERCHARGE',
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 3 } },
    })

    t.advanceTo('SPACE_COMBAT')

    // Round 1: Supercharge not yet active
    t.advanceRound({ defender: 1 })

    expect(t.defender.units.CRUISER).toHaveLength(2)
    expect(t.abilityLog('TECHNOLOGICAL_SINGULARITY')).not.toHaveLength(0)

    // Round 1 dice: normal Cruiser [7, 1]
    const round1Pool = t.dicePool()
    expect(round1Pool.attacker).toContainDice('CRUISER', [7, 1])

    // Round 2: Supercharge now active → Cruiser: 7 - 1 = 6
    t.advanceRound()
    const round2Pool = t.dicePool()

    expect(round2Pool.attacker).toContainDice('CRUISER', [6, 1])
  })
})
