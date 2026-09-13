import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('TF_TEMPORAL_COMMAND_SUITE', () => {
  it('re-readies the chosen genome, granting it an extra use', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { CRUISER: 3 },
        abilities: {
          // Altruistic Genome (Tellurian): exhaust to cancel a hit
          TF_ALTRUISTIC_GENOME: true,
          TF_TEMPORAL_COMMAND_SUITE: {
            isEnabled: true,
            genomes: [['TF_ALTRUISTIC_GENOME', 1]],
          },
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

  it('the same genome can be re-readied several times', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { CRUISER: 4 },
        abilities: {
          TF_ALTRUISTIC_GENOME: true,
          // 2 tokens on one genome: base 1 use + 2 → cancels three rounds
          TF_TEMPORAL_COMMAND_SUITE: {
            isEnabled: true,
            genomes: [['TF_ALTRUISTIC_GENOME', 2]],
          },
        },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 1 })
    t.advanceRound({ attacker: 1 })
    t.advanceRound({ attacker: 1 })
    expect(t.attacker.units.CRUISER).toHaveLength(4)
  })

  it('each genome receives its own token count', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { CRUISER: 3, DREADNOUGHT: 1 },
        abilities: {
          TF_ALTRUISTIC_GENOME: true,
          // Aristocratic Genome (Viscount Unlenn): +1 die for one ship
          TF_ARISTOCRATIC_GENOME: { isEnabled: true, unitType: 'DREADNOUGHT' },
          TF_TEMPORAL_COMMAND_SUITE: {
            isEnabled: true,
            genomes: [
              ['TF_ALTRUISTIC_GENOME', 1],
              ['TF_ARISTOCRATIC_GENOME', 2],
            ],
          },
        },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT')
    // Granted at PREPARE: base 1 use each → 2 and 3.
    expect(t.state.attacker.abilities.TF_ALTRUISTIC_GENOME.uses).toBe(2)
    expect(t.state.attacker.abilities.TF_ARISTOCRATIC_GENOME.uses).toBe(3)
  })

  it('a re-readied genome still fires at most once per window', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { CRUISER: 3 },
        abilities: {
          TF_ALTRUISTIC_GENOME: true,
          TF_TEMPORAL_COMMAND_SUITE: {
            isEnabled: true,
            genomes: [['TF_ALTRUISTIC_GENOME', 1]],
          },
        },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT')
    // Round 1, 2 hits in one assign-hits window: the genome exhausts on the
    // first (one cancel per window — the re-ready happens after the
    // exhaust, not inside it), the second lands and kills a cruiser.
    t.advanceRound({ attacker: 2 })
    expect(t.attacker.units.CRUISER).toHaveLength(2)

    // Round 2: the re-readied genome cancels again.
    t.advanceRound({ attacker: 1 })
    expect(t.attacker.units.CRUISER).toHaveLength(2)
  })

  it('genomes with a zero count receive nothing', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { CRUISER: 3 },
        abilities: {
          TF_ALTRUISTIC_GENOME: true,
          TF_TEMPORAL_COMMAND_SUITE: {
            isEnabled: true,
            genomes: [['TF_ALTRUISTIC_GENOME', 0]],
          },
        },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT')
    expect(t.state.attacker.abilities.TF_ALTRUISTIC_GENOME.uses).toBe(1)
  })

  it('without the suite the genome exhausts after one use', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { CRUISER: 3 },
        abilities: { TF_ALTRUISTIC_GENOME: true },
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
