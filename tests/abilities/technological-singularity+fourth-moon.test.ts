import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('TECHNOLOGICAL_SINGULARITY + FOURTH_MOON', () => {
  it('lifts the gained Sustain restriction when the flagship is destroyed', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NEKRO_VIRUS',
        units: { FLAGSHIP: 1 },
        abilities: {
          TECHNOLOGICAL_SINGULARITY: {
            isEnabled: true,
            enableAbilityKey: 'NEKRO_FLAGSHIP_FOURTH_MOON',
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 3 } },
    })

    t.advanceTo('SPACE_COMBAT')

    // Round 1: a defender cruiser dies → TS gains Fourth Moon
    t.advanceRound({ defender: 1 })
    expect(t.abilityLog('TECHNOLOGICAL_SINGULARITY')).not.toHaveLength(0)
    expect(
      t.defender.unitAbilityRestrictions?.cannotBeUsed?.SUSTAIN_DAMAGE,
    ).toBeDefined()

    // Round 2: the flagship sustains, then dies → the restriction lifts
    t.advanceRound({ attacker: 2 })
    expect(t.attacker.units.FLAGSHIP).toBeUndefined()
    expect(
      t.defender.unitAbilityRestrictions?.cannotBeUsed?.SUSTAIN_DAMAGE,
    ).toBeFalsy()
  })
})
