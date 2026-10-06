import { describe, expect, it } from 'vitest'

import { CombatSetup } from '@/hooks/combat-setup'

import { combatTest } from '../utils/combat-test'
import { hitOrderUnits, setAbility } from '../utils/setup-options'

describe.forEachSide('GREYFIRE_MUTAGEN', () => {
  it('replaces 1 opponent infantry with own infantry', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'EMIRATES_OF_HACAN',
        units: { INFANTRY: 1 },
        abilities: { GREYFIRE_MUTAGEN: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
    })

    t.advanceTo('GROUND_COMBAT')

    t.advanceRound()

    expect(t.abilityLog('GREYFIRE_MUTAGEN')).not.toHaveLength(0)
    expect(t.attacker.units.INFANTRY).toHaveLength(2)
    expect(t.defender.units.INFANTRY).toHaveLength(1)
  })

  it('does not fire when opponent has fewer than 2 ground forces', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'EMIRATES_OF_HACAN',
        units: { INFANTRY: 1 },
        abilities: { GREYFIRE_MUTAGEN: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 1 },
      },
    })

    t.advanceTo('GROUND_COMBAT')

    t.advanceRound()

    expect(t.abilityLog('GREYFIRE_MUTAGEN')).toHaveLength(0)
    expect(t.attacker.units.INFANTRY).toHaveLength(1)
    expect(t.defender.units.INFANTRY).toHaveLength(1)
  })

  it('does not fire when opponent has no infantry (only mechs)', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'EMIRATES_OF_HACAN',
        units: { INFANTRY: 1 },
        abilities: { GREYFIRE_MUTAGEN: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { MECH: 2 },
      },
    })

    t.advanceTo('GROUND_COMBAT')

    t.advanceRound()

    expect(t.abilityLog('GREYFIRE_MUTAGEN')).toHaveLength(0)
    expect(t.attacker.units.INFANTRY).toHaveLength(1)
    expect(t.defender.units.MECH).toHaveLength(2)
  })

  it('does not fire when opponent is Yin Brotherhood', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'EMIRATES_OF_HACAN',
        units: { INFANTRY: 1 },
        abilities: { GREYFIRE_MUTAGEN: true },
      },
      defender: {
        faction: 'YIN_BROTHERHOOD',
        units: { INFANTRY: 2 },
      },
    })

    t.advanceTo('GROUND_COMBAT')

    t.advanceRound()

    expect(t.abilityLog('GREYFIRE_MUTAGEN')).toHaveLength(0)
    expect(t.attacker.units.INFANTRY).toHaveLength(1)
    expect(t.defender.units.INFANTRY).toHaveLength(2)
  })

  it('replaces a galvanized opponent infantry', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'EMIRATES_OF_HACAN',
        units: { INFANTRY: 1 },
        abilities: { GREYFIRE_MUTAGEN: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
        abilities: {
          PRE_GALVANIZED: {
            isEnabled: true,
            galvanizedUnits: [['INFANTRY', 2]],
          },
        },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound()

    expect(t.abilityLog('GREYFIRE_MUTAGEN')).not.toHaveLength(0)
    expect(t.attacker.units.INFANTRY).toHaveLength(2)
    expect(t.defender.units.INFANTRY).toHaveLength(1)
    const remaining = t.defender.units.INFANTRY!
    expect(remaining[0]?.subtypes).toContain('Galvanized')
  })

  it('fires when opponent has mix of mechs and infantry totaling 2+ ground forces', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'EMIRATES_OF_HACAN',
        units: { INFANTRY: 1 },
        abilities: { GREYFIRE_MUTAGEN: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { MECH: 1, INFANTRY: 1 },
      },
    })

    t.advanceTo('GROUND_COMBAT')

    t.advanceRound()

    expect(t.abilityLog('GREYFIRE_MUTAGEN')).not.toHaveLength(0)
    expect(t.attacker.units.INFANTRY).toHaveLength(2)
    expect(t.defender.units.INFANTRY).toBeUndefined()
    expect(t.defender.units.MECH).toHaveLength(1)
  })

  it('declares its infantry for the hit order', () => {
    const setup = new CombatSetup()
    setup.setFaction('attacker', 'YIN_BROTHERHOOD')
    setup.setCombatMode('GROUND')
    setup.setUnitCount('attacker', 'MECH', 1)
    const infantry = 'INFANTRY'
    expect(hitOrderUnits(setup, 'GROUND')).not.toContain(infantry)

    setAbility(setup, 'attacker', 'GREYFIRE_MUTAGEN', { isEnabled: true })
    expect(hitOrderUnits(setup, 'GROUND')).toContain(infantry)
  })
})
