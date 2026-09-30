import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('X_89_BACTERIAL_WEAPON', () => {
  it('doubles bombardment hits', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 2 },
        abilities: { X_89_BACTERIAL_WEAPON: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 4 },
      },
    })

    // Bombardment: 1 natural hit, X-89 doubles to 2
    t.advanceTo('SPACE_CANNON_DEFENSE', { defender: 1 })

    expect(t.abilityLog('X_89_BACTERIAL_WEAPON')).not.toHaveLength(0)
    expect(t.defender.units.INFANTRY).toHaveLength(2)
  })

  it('keeps added bombardment hits subject to phase eligibility', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, INFANTRY: 1 },
        abilities: { X_89_BACTERIAL_WEAPON: true },
      },
      defender: {
        faction: 'NAAZ_ROKHA_ALLIANCE',
        units: { MECH: 1 },
        abilities: { EIDOLON_MAXIMUM: true },
      },
    })

    t.advanceTo('SPACE_CANNON_DEFENSE', { defender: 1 })

    expect(t.defender.units.MECH).toHaveLength(1)
    expect(t.defender.units.MECH![0].isDamaged).toBeFalsy()
  })

  it('doubles ground combat hits', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { INFANTRY: 3 },
        abilities: { X_89_BACTERIAL_WEAPON: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 4 },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    // Attacker produces 1 natural hit, X-89 doubles to 2
    t.advanceRound({ defender: 1 })

    expect(t.abilityLog('X_89_BACTERIAL_WEAPON')).not.toHaveLength(0)
    expect(t.defender.units.INFANTRY).toHaveLength(2)
  })

  it('doubles both bombardment and ground combat hits in same battle', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, INFANTRY: 2 },
        abilities: { X_89_BACTERIAL_WEAPON: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 5 },
      },
    })

    // Bombardment: 1 natural hit, X-89 doubles to 2
    t.advanceTo('SPACE_CANNON_DEFENSE', { defender: 1 })
    expect(t.defender.units.INFANTRY).toHaveLength(3)

    t.advanceTo('GROUND_COMBAT')
    // Ground combat: 1 natural hit, X-89 doubles to 2
    t.advanceRound({ defender: 1 })

    expect(t.abilityLog('X_89_BACTERIAL_WEAPON')).not.toHaveLength(0)
    expect(t.defender.units.INFANTRY).toHaveLength(1)
  })
})
