import { describe, expect, it } from 'vitest'

import { makeUnitLocator } from '@/combat'
import { CombatSetup } from '@/hooks/combat-setup'
import { DEFAULT_PLANET_ID } from '@/types'

import { combatTest } from '../utils/combat-test'
import { hitOrderUnits, setAbility } from '../utils/setup-options'

describe.forEachSide('INDOCTRINATION', () => {
  it('replaces 1 opponent infantry with own infantry', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'YIN_BROTHERHOOD',
        units: { INFANTRY: 2 },
        abilities: { INDOCTRINATION: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 3 },
      },
    })

    t.advanceTo('GROUND_COMBAT')

    t.advanceRound()

    expect(t.abilityLog('INDOCTRINATION')).not.toHaveLength(0)
    expect(t.attacker.units.INFANTRY).toHaveLength(3)
    expect(t.defender.units.INFANTRY).toHaveLength(2)
  })

  it('does not fire in space combat', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'YIN_BROTHERHOOD',
        units: { CRUISER: 1 },
        abilities: { INDOCTRINATION: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1, INFANTRY: 1 },
      },
    })

    t.advanceTo('SPACE_COMBAT')

    t.advanceRound()

    expect(t.abilityLog('INDOCTRINATION')).toHaveLength(0)
  })

  it('does not fire if opponent has no infantry', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'YIN_BROTHERHOOD',
        units: { INFANTRY: 2 },
        abilities: { INDOCTRINATION: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { MECH: 1 },
      },
    })

    t.advanceTo('GROUND_COMBAT')

    t.advanceRound()

    expect(t.abilityLog('INDOCTRINATION')).toHaveLength(0)
    expect(t.attacker.units.INFANTRY).toHaveLength(2)
  })

  it('replaces a galvanized opponent infantry', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'YIN_BROTHERHOOD',
        units: { INFANTRY: 2 },
        abilities: { INDOCTRINATION: true },
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

    expect(t.abilityLog('INDOCTRINATION')).not.toHaveLength(0)
    expect(t.attacker.units.INFANTRY).toHaveLength(3)
    expect(t.defender.units.INFANTRY).toHaveLength(1)
    const remaining = t.defender.units.INFANTRY!
    expect(remaining[0]?.subtypes).toContain('Galvanized')
  })

  it('declares its infantry for the hit order', () => {
    const setup = new CombatSetup()
    setup.setFaction('attacker', 'YIN_BROTHERHOOD')
    setup.setCombatMode('GROUND')
    setup.setUnitCount('attacker', 'MECH', 1)
    const infantry = makeUnitLocator('INFANTRY', DEFAULT_PLANET_ID)
    expect(hitOrderUnits(setup, 'GROUND')).not.toContain(infantry)

    setAbility(setup, 'attacker', 'INDOCTRINATION', { isEnabled: true })
    expect(hitOrderUnits(setup, 'GROUND')).toContain(infantry)
  })
})
