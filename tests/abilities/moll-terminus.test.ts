import { describe, expect, it } from 'vitest'

import { SPACE_SURFACE_ID } from '@/types'

import { combatTest } from '../utils/combat-test'
import { PLANET_1, PLANET_2, TWO_PLANET_INVASION } from '../utils/surface-units'

describe('MOLL_TERMINUS', () => {
  it('does not disable sustain in space combat', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { MECH: 1, CRUISER: 1 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ defender: 1 })

    // Dreadnought can sustain (Moll Terminus only works in ground combat)
    expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBe(true)
    expect(t.defender.units.DREADNOUGHT).toHaveLength(1)
  })

  it('allows opponent sustain during bombardment', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { DREADNOUGHT: 1, MECH: 1 },
      },
      defender: {
        // Federation of Sol mech has Sustain Damage but no Planetary Shield
        faction: 'FEDERATION_OF_SOL',
        units: { MECH: 1 },
      },
    })

    // Advance past bombardment — defender receives 1 hit
    t.advanceTo('SPACE_CANNON_DEFENSE', { defender: 1 })

    // Defender mech sustained bombardment hit (Moll Terminus allows it)
    expect(t.defender.units.MECH![0].isDamaged).toBe(true)
    expect(t.defender.units.MECH).toHaveLength(1)
  })

  it('disables opponent sustain during space cannon defense', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'FEDERATION_OF_SOL',
        units: { MECH: 1 },
      },
      defender: {
        faction: 'MENTAK_COALITION',
        units: { MECH: 1, PDS: 1 },
      },
    })

    // Advance past SCD — attacker receives 1 hit from PDS
    t.advanceTo('GROUND_COMBAT', { attacker: 1 })

    // Attacker mech can't sustain (Moll Terminus disabled it) — destroyed
    expect(t.attacker.units.MECH).toBeUndefined()
  })

  it('disables opponent sustain during ground combat', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { MECH: 1, INFANTRY: 1 },
      },
      defender: {
        faction: 'FEDERATION_OF_SOL',
        units: { MECH: 1 },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound({ defender: 1 })

    // Defender mech can't sustain (Moll Terminus disabled it) — destroyed
    expect(t.defender.units.MECH).toBeUndefined()
  })

  it('re-enables sustain only after last mech is destroyed', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: { MECH: 2 },
      },
      defender: {
        faction: 'FEDERATION_OF_SOL',
        units: { INFANTRY: 3 },
      },
    })

    t.advanceTo('GROUND_COMBAT')

    // Round 1: first mech sustains
    t.advanceRound({ attacker: 1 })
    expect(t.attacker.units.MECH).toHaveLength(2)
    expect(
      t.defender.unitAbilityRestrictions?.cannotBeUsed?.SUSTAIN_DAMAGE,
    ).toBeDefined()

    // Round 2: second mech sustains — both damaged
    t.advanceRound({ attacker: 1 })
    expect(t.attacker.units.MECH).toHaveLength(2)
    expect(
      t.defender.unitAbilityRestrictions?.cannotBeUsed?.SUSTAIN_DAMAGE,
    ).toBeDefined()

    // Round 3: first mech destroyed, one remains
    t.advanceRound({ attacker: 1 })
    expect(t.attacker.units.MECH).toHaveLength(1)
    expect(
      t.defender.unitAbilityRestrictions?.cannotBeUsed?.SUSTAIN_DAMAGE,
    ).toBeDefined()

    // Round 4: last mech destroyed — restriction removed
    t.advanceRound({ attacker: 1 })
    expect(t.attacker.units.MECH).toBeUndefined()
    expect(
      t.defender.unitAbilityRestrictions?.cannotBeUsed?.SUSTAIN_DAMAGE,
    ).toBeFalsy()
  })

  it('disables sustain for a mech committed from space', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'MENTAK_COALITION',
        units: {},
        placements: { [SPACE_SURFACE_ID]: { MECH: 1, INFANTRY: 1 } },
      },
      defender: {
        faction: 'FEDERATION_OF_SOL',
        units: {},
        placements: { [PLANET_1]: { MECH: 1 } },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound({ defender: 1 })

    expect(t.defender.units.MECH).toBeUndefined()
  })

  it('disables sustain only on its own planet', () => {
    const t = combatTest({
      ...TWO_PLANET_INVASION,
      attacker: {
        faction: 'FEDERATION_OF_SOL',
        units: {},
        placements: { [PLANET_2]: { MECH: 1 } },
      },
      defender: {
        faction: 'MENTAK_COALITION',
        units: {},
        placements: { [PLANET_1]: { MECH: 1 }, [PLANET_2]: { INFANTRY: 2 } },
      },
    })

    // Nothing fights on planet 1, where the Mentak mech stands.
    t.advanceTo('GROUND_COMBAT')
    expect(t.state.activeSurfaceId).toBe(PLANET_2)
    t.advanceRound({ attacker: 1 })

    expect(t.attacker.units.MECH![0].isDamaged).toBe(true)
  })
})
