import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('BOMBARDMENT + SUSTAIN_DAMAGE', () => {
  it('mech sustains a bombardment hit by default', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: { faction: 'ARBOREC', units: { DREADNOUGHT: 1 } },
      defender: { faction: 'SARDAKK_NORR', units: { MECH: 2 } },
    })

    // Dreadnought bombardment [5, 1]; force exactly 1 hit onto the defender.
    t.advanceTo('SPACE_CANNON_DEFENSE', { attacker: 0, defender: 1 })

    // Both mechs survive; one used Sustain Damage.
    expect(t.defender.units.MECH).toHaveLength(2)
    expect(t.defender.units.MECH!.some(m => m.isDamaged)).toBe(true)
  })

  it('mech cannot sustain a bombardment hit when disableSustainDamage is on', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1 },
        abilities: { BOMBARDMENT: { disableSustainDamage: true } },
      },
      defender: { faction: 'SARDAKK_NORR', units: { MECH: 2 } },
    })

    t.advanceTo('SPACE_CANNON_DEFENSE', { attacker: 0, defender: 1 })

    // One mech destroyed (no sustain); the survivor is undamaged.
    expect(t.defender.units.MECH).toHaveLength(1)
    expect(t.defender.units.MECH![0].isDamaged).toBeFalsy()
  })

  it('disableSustainDamage is scoped to bombardment — sustain still works in ground combat', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, INFANTRY: 3 },
        abilities: { BOMBARDMENT: { disableSustainDamage: true } },
      },
      defender: { faction: 'SARDAKK_NORR', units: { MECH: 2 } },
    })

    // 0 bombardment hits (default), advance into ground combat.
    t.advanceTo('GROUND_COMBAT')
    // Defender mech takes 1 ground-combat hit and sustains it (override gone).
    t.advanceRound({ attacker: 0, defender: 1 })

    expect(t.defender.units.MECH).toHaveLength(2)
    expect(t.defender.units.MECH!.some(m => m.isDamaged)).toBe(true)
  })

  it('inherits the target ground UNIT_PRIORITY', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, INFANTRY: 1 },
        abilities: { BOMBARDMENT: { disableSustainDamage: true } },
      },
      defender: {
        faction: 'SARDAKK_NORR',
        units: { MECH: 1, INFANTRY: 1 },
        abilities: {
          UNIT_PRIORITY: {
            groundUnitPriority: [['MECH'], ['INFANTRY']],
          },
        },
      },
    })

    t.advanceTo('SPACE_CANNON_DEFENSE', { defender: 1 })

    expect(t.defender.units.MECH).toBeUndefined()
    expect(t.defender.units.INFANTRY).toHaveLength(1)
  })

  it('uses an outgoing custom priority as the eligibility list', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, INFANTRY: 1 },
        abilities: {
          BOMBARDMENT: {
            customPriority: true,
            unitPriority: [['INFANTRY']],
            disableSustainDamage: true,
          },
        },
      },
      defender: {
        faction: 'SARDAKK_NORR',
        units: { MECH: 1, INFANTRY: 1 },
      },
    })

    t.advanceTo('SPACE_CANNON_DEFENSE', { defender: 1 })

    expect(t.defender.units.INFANTRY).toBeUndefined()
    expect(t.defender.units.MECH).toHaveLength(1)
  })
})
