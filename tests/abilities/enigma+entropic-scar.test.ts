import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

// Il Na Viroset flagship "ignores the effects of all anomalies" — so it keeps
// its unit abilities (Sustain Damage) inside an Entropic Scar, while every
// other unit on the side is still stripped by the scar.
describe('TF_ENIGMA + ENTROPIC_SCAR', () => {
  it('the flagship still sustains inside the scar', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'IL_NA_VIROSET',
        units: { FLAGSHIP: 1 },
        abilities: { ENTROPIC_SCAR: true },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 1 })

    // Survived the hit, damaged rather than destroyed → it sustained.
    expect(t.attacker.units.FLAGSHIP).toHaveLength(1)
    expect(t.attacker.units.FLAGSHIP?.[0].isDamaged).toBe(true)
  })

  it('does not extend the immunity to the rest of the side', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'IL_NA_VIROSET',
        units: { FLAGSHIP: 1, DREADNOUGHT: 1 },
        abilities: { ENTROPIC_SCAR: true },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 3 } },
    })

    t.advanceTo('SPACE_COMBAT')
    // The flagship sustains the first hit; the second lands on the
    // dreadnought, which the scar keeps from sustaining.
    t.advanceRound({ attacker: 2 })

    expect(t.attacker.units.DREADNOUGHT).toBeUndefined()
    expect(t.attacker.units.FLAGSHIP).toHaveLength(1)
  })

  it('still blocks non-flagship unit abilities on the same side', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'IL_NA_VIROSET',
        units: { FLAGSHIP: 1, DESTROYER: 1 },
        abilities: { ENTROPIC_SCAR: true },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 2 } },
    })

    t.advanceToTiming('ANNOUNCE_RETREAT_STEP')

    // Destroyer AFB is still disabled by the scar.
    expect(t.dicePool()?.attacker?.DESTROYER).toBeUndefined()
  })

  it('another faction flagship is still stripped by the scar', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { FLAGSHIP: 1 },
        abilities: { ENTROPIC_SCAR: true },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 1 })

    expect(t.attacker.units.FLAGSHIP).toBeUndefined()
  })
})
