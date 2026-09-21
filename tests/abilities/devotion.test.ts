import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('DEVOTION', () => {
  it('destroys own destroyer to produce a hit against opponent ship', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'YIN_BROTHERHOOD',
        units: { CRUISER: 1, DESTROYER: 1 },
        abilities: { DEVOTION: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    // Destroyer sacrificed, opponent loses a cruiser
    expect(t.attacker.units.DESTROYER).toBeUndefined()
    expect(t.defender.units.CRUISER).toHaveLength(1)
    expect(t.abilityLog('DEVOTION')).not.toHaveLength(0)
  })

  it('destroys own cruiser when no destroyer available', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'YIN_BROTHERHOOD',
        units: { CRUISER: 2 },
        abilities: { DEVOTION: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    // One cruiser sacrificed
    expect(t.attacker.units.CRUISER).toHaveLength(1)
    expect(t.defender.units.CRUISER).toHaveLength(1)
  })

  it('damages a ship with sustain damage instead of destroying it', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'YIN_BROTHERHOOD',
        units: { DESTROYER: 1, CRUISER: 1 },
        abilities: { DEVOTION: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    expect(t.attacker.units.DESTROYER).toBeUndefined()
    expect(t.defender.units.DREADNOUGHT).toHaveLength(1)
    expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBe(true)
  })

  it('does not fire when disabled', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'YIN_BROTHERHOOD',
        units: { CRUISER: 1, DESTROYER: 1 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    expect(t.attacker.units.DESTROYER).toHaveLength(1)
    expect(t.defender.units.CRUISER).toHaveLength(2)
    expect(t.abilityLog('DEVOTION')).toHaveLength(0)
  })

  it('does not fire when no cruiser or destroyer available', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'YIN_BROTHERHOOD',
        units: { FLAGSHIP: 1 },
        abilities: { DEVOTION: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    expect(t.abilityLog('DEVOTION')).toHaveLength(0)
  })

  it('targets the exact variant from priority, not the base type', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'YIN_BROTHERHOOD',
        units: { DESTROYER: 1 },
        abilities: {
          DEVOTION: {
            isEnabled: true,
            targetPriority: [
              ['CRUISER:Galvanized', true],
              ['CRUISER', false],
            ],
          },
        },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2 },
        abilities: {
          PRE_GALVANIZED: {
            isEnabled: true,
            galvanizedUnits: [['CRUISER', 1]],
            reinforcementTokens: 0,
          },
          UNIT_PRIORITY: {
            spaceUnitPriority: [['CRUISER'], ['CRUISER:Galvanized']],
          },
        },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    // Defender's UNIT_PRIORITY sacrifices plain CRUISER first. With the bug
    // (addHits widening to base type CRUISER) the plain cruiser would be
    // destroyed; the fix narrows unitPriority to CRUISER:Galvanized so the
    // plain cruiser is untouched.
    const remaining = t.defender.units.CRUISER ?? []
    const plain = remaining.filter(u => !u.subtypes || u.subtypes.length === 0)
    expect(plain).toHaveLength(1)
  })

  it('fires each round when units are available', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'YIN_BROTHERHOOD',
        units: { DESTROYER: 2, CRUISER: 1 },
        abilities: { DEVOTION: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound() // round 1: sacrifice 1 destroyer
    t.advanceRound() // round 2: sacrifice 1 destroyer

    expect(t.attacker.units.DESTROYER).toBeUndefined()
    // Fires each round — 2 sacrifice+destroy cycles
    expect(t.abilityLog('DEVOTION')).not.toHaveLength(0)
  })
})
