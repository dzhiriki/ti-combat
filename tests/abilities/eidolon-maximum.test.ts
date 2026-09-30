import { describe, expect, it } from 'vitest'

import { DEFAULT_PLANET_ID, SPACE_SURFACE_ID } from '@/types'

import { combatTest } from '../utils/combat-test'

describe('EIDOLON_MAXIMUM', () => {
  it('mech has [4, 4] stats in space combat', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { CRUISER: 1, MECH: 1 },
        abilities: { EIDOLON_MAXIMUM: true },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()
    const pool = t.dicePool()

    // Eidolon Maximum: [4, 4]
    expect(pool.attacker).toContainDice('MECH', [4, 4])
  })

  it('mech on a planet fights in space combat as a ship', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: {},
        placements: {
          [SPACE_SURFACE_ID]: { CRUISER: 1 },
          [DEFAULT_PLANET_ID]: { MECH: 1 },
        },
        abilities: { EIDOLON_MAXIMUM: true },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    expect(t.dicePool().attacker).toContainDice('MECH', [4, 4])
  })

  it('mech has [4, 4] stats in ground combat', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { MECH: 1, INFANTRY: 1 },
        abilities: { EIDOLON_MAXIMUM: true },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 1 } },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound()
    const pool = t.dicePool()

    // Eidolon Maximum: [4, 4]
    expect(pool.attacker).toContainDice('MECH', [4, 4])
  })

  it('mech can sustain damage (unlike Z-Grav Eidolon)', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { CRUISER: 1, MECH: 1 },
        abilities: {
          EIDOLON_MAXIMUM: true,
          SUSTAIN_DAMAGE: { spacePriority: [['MECH', true]] },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 1 })

    // Mech should sustain — unlike Z-Grav which loses Sustain Damage
    expect(t.attacker.units.MECH![0].isDamaged).toBe(true)
    expect(t.attacker.units.MECH).toHaveLength(1)
  })

  it('repairs mech at start of combat round', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { CRUISER: 1, MECH: 1 },
        abilities: {
          EIDOLON_MAXIMUM: true,
          SUSTAIN_DAMAGE: { spacePriority: [['MECH', true]] },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    // Round 1: mech sustains a hit
    t.advanceRound({ attacker: 1 })
    expect(t.attacker.units.MECH![0].isDamaged).toBe(true)

    // Round 2: mech repairs at start of round
    t.advanceRound()
    expect(t.attacker.units.MECH![0].isDamaged).toBeFalsy()
  })

  it('overrides Z-Grav Eidolon transform', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { CRUISER: 1, MECH: 1 },
        abilities: { EIDOLON_MAXIMUM: true },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()
    const pool = t.dicePool()

    // Should NOT have Z-Grav [8, 2] stats
    expect(pool.attacker).toContainDice('MECH', [4, 4])
    // Eidolon ability should not have fired
    expect(t.abilityLog('EIDOLON')).toHaveLength(0)
  })

  it('mech is immune to space cannon offense hits', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { CRUISER: 1, MECH: 1 },
        abilities: { EIDOLON_MAXIMUM: true },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 1, PDS: 3 } },
    })

    // Advance past SCO — attacker receives 3 hits
    t.advanceTo('AFB', { attacker: 3 })

    // Mech should survive SCO — only Cruiser can be hit
    expect(t.attacker.units.MECH).toHaveLength(1)
    expect(t.attacker.units.CRUISER).toBeUndefined()
  })

  it('mech is immune to bombardment hits', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 1, DREADNOUGHT: 5 },
      },
      defender: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { MECH: 1, INFANTRY: 1 },
        abilities: { EIDOLON_MAXIMUM: true },
      },
    })

    // Advance past bombardment — defender receives 5 hit
    t.advanceTo('SPACE_CANNON_DEFENSE', { defender: 5 })

    // Mech should survive bombardment — only infantry can be hit
    expect(t.defender.units.MECH).toHaveLength(1)
    expect(t.defender.units.INFANTRY).toBeUndefined()
  })

  it('mech is immune to space cannon defense hits', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { MECH: 1, INFANTRY: 1 },
        abilities: { EIDOLON_MAXIMUM: true },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 1, PDS: 3 } },
    })

    // Advance past SCD — attacker receives 5 hit
    t.advanceTo('GROUND_COMBAT', { attacker: 3 })

    // Mech should survive SCD — only infantry can be hit
    expect(t.attacker.units.MECH).toHaveLength(1)
    expect(t.attacker.units.INFANTRY).toBeUndefined()
  })

  it('mech can be destroyed by regular combat hits', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { MECH: 1 },
        abilities: { EIDOLON_MAXIMUM: true },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 2 })

    // Mech takes 2 hits: 1 sustain + 1 kill
    expect(t.attacker.units.MECH).toBeUndefined()
  })
})
