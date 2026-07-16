import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('TF_SINGULARITY_X', () => {
  it('copies an opponent ability mid-combat, after an opponent unit is destroyed', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { CRUISER: 3 },
        abilities: {
          TF_SINGULARITY_X: { isEnabled: true, copyKey: 'UNRELENTING' },
        },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 3 } },
    })

    t.advanceTo('SPACE_COMBAT')

    // Round 1: no opponent unit has died yet, so the copied Unrelenting is NOT
    // active — cruisers roll at their base combat value of 7.
    t.advanceRound({ defender: 1 })
    expect(t.dicePool().attacker).toContainDice('CRUISER', [7, 1])
    expect(t.abilityLog('TF_SINGULARITY_X')).not.toHaveLength(0)

    // Round 2: a defender cruiser was destroyed last round, so Singularity has
    // granted Unrelenting (+1) — cruisers now hit on 6.
    t.advanceRound()
    expect(t.dicePool().attacker).toContainDice('CRUISER', [6, 1])
  })

  it('does not fire when no ability is selected to copy', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { CRUISER: 3 },
        abilities: { TF_SINGULARITY_X: { isEnabled: true } },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 3 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ defender: 1 })
    t.advanceRound()

    // Still base combat value — nothing was copied
    expect(t.dicePool().attacker).toContainDice('CRUISER', [7, 1])
    expect(t.abilityLog('TF_SINGULARITY_X')).toHaveLength(0)
  })
})
