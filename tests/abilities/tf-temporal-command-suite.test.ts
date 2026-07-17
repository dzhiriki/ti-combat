import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('TF_TEMPORAL_COMMAND_SUITE', () => {
  it('re-readies the chosen genome, granting it an extra use', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { CRUISER: 3 },
        abilities: {
          // Altruistic Genome (Tellurian): exhaust to cancel a hit
          TELLURIAN: true,
          TF_TEMPORAL_COMMAND_SUITE: { uses: 1, genomeKey: 'TELLURIAN' },
        },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT')
    // Round 1: genome exhausts cancelling the hit; the suite readies it
    t.advanceRound({ attacker: 1 })
    expect(t.attacker.units.CRUISER).toHaveLength(3)
    // Round 2: the re-readied genome cancels again
    t.advanceRound({ attacker: 1 })
    expect(t.attacker.units.CRUISER).toHaveLength(3)
  })

  it('without the suite the genome exhausts after one use', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { CRUISER: 3 },
        abilities: { TELLURIAN: true },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 1 })
    expect(t.attacker.units.CRUISER).toHaveLength(3)
    t.advanceRound({ attacker: 1 })
    expect(t.attacker.units.CRUISER).toHaveLength(2)
  })
})
