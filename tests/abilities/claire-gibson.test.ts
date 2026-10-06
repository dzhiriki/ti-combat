import { describe, expect, it } from 'vitest'

import { CombatSetup } from '@/hooks/combat-setup'

import { combatTest } from '../utils/combat-test'
import { hitOrderUnits, setAbility } from '../utils/setup-options'

describe('Claire Gibson', () => {
  it('places 1 infantry at start of ground combat', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
        abilities: { CLAIRE_GIBSON: { isEnabled: true } },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound()

    expect(t.abilityLog('CLAIRE_GIBSON')).not.toHaveLength(0)
    expect(t.defender.units.INFANTRY).toHaveLength(3)
  })

  it('does not fire when bombardment kills all defenders', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, INFANTRY: 2 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 1 },
        abilities: { CLAIRE_GIBSON: { isEnabled: true } },
      },
    })

    // Bombardment: dreadnought [5, 1] — pick 1-hit branch to kill
    // the defender's only infantry
    t.advanceTo('COMPLETE', 1)

    expect(t.isFinished()).toBe(true)
    expect(t.defender.units.INFANTRY).toBeUndefined()
  })

  it('only fires for the defender', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
        abilities: { CLAIRE_GIBSON: { isEnabled: true } },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2 },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound()

    // Attacker should not gain infantry
    expect(t.attacker.units.INFANTRY).toHaveLength(2)
  })

  it('declares its infantry for the hit order', () => {
    const setup = new CombatSetup()
    setup.setCombatMode('GROUND')
    setup.setUnitCount('defender', 'MECH', 1)
    const infantry = 'INFANTRY'
    expect(hitOrderUnits(setup, 'GROUND', 'defender')).not.toContain(infantry)

    setAbility(setup, 'defender', 'CLAIRE_GIBSON', { isEnabled: true })
    expect(hitOrderUnits(setup, 'GROUND', 'defender')).toContain(infantry)
  })
})
