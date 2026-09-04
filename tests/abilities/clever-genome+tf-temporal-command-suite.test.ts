import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('TF_CLEVER_GENOME + TF_TEMPORAL_COMMAND_SUITE', () => {
  it('Clever Genome doubles the copied text in one window, and TCS re-readies it', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { CRUISER: 3 },
        abilities: {
          // Real Altruistic Genome (Tellurian) + Clever Genome copying it —
          // two ability instances, so BOTH cancel in the same window.
          TF_ALTRUISTIC_GENOME: true,
          TF_CLEVER_GENOME: {
            isEnabled: true,
            genomeKey: 'TF_ALTRUISTIC_GENOME',
          },
          // The token readies the Clever card itself.
          TF_TEMPORAL_COMMAND_SUITE: {
            isEnabled: true,
            genomes: [['TF_CLEVER_GENOME', 1]],
          },
        },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT')
    // Round 1, 2 hits in ONE assign-hits window: Tellurian cancels one,
    // Clever-as-Tellurian cancels the other — the double trigger that extra
    // uses on the original could never produce.
    t.advanceRound({ attacker: 2 })
    expect(t.attacker.units.CRUISER).toHaveLength(3)

    // Round 2: Tellurian is spent, but the TCS token re-readied Clever.
    t.advanceRound({ attacker: 1 })
    expect(t.attacker.units.CRUISER).toHaveLength(3)

    // Round 3: everything is exhausted — the hit lands.
    t.advanceRound({ attacker: 1 })
    expect(t.attacker.units.CRUISER).toHaveLength(2)
  })
})
