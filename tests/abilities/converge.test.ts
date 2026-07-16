import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('TF_CONVERGE', () => {
  it('forces Space Cannon Offense hits onto non-fighter ships', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { CRUISER: 1, FIGHTER: 2 },
      },
      defender: {
        faction: 'AVARICE_REX',
        units: { PDS: 1, CRUISER: 1 },
        abilities: { TF_CONVERGE: true },
      },
    })

    // Defender PDS fires Space Cannon; force 1 hit onto the attacker.
    t.advanceTo('AFB', { attacker: 1 })

    // Converge routes the hit to the non-fighter cruiser, sparing the fighters.
    expect(t.attacker.units.CRUISER).toBeUndefined()
    expect(t.attacker.units.FIGHTER).toHaveLength(2)
  })

  it('forces Space Cannon Defense hits onto mechs in ground combat', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'AVARICE_REX',
        units: { INFANTRY: 2, MECH: 1 },
      },
      defender: {
        faction: 'AVARICE_REX',
        units: { PDS: 1, INFANTRY: 1 },
        abilities: {
          TF_CONVERGE: true,
          // Strip the mech's sustain so the assignment target is observable.
          SPACE_CANNON_DEFENSE: { isEnabled: true, disableSustainDamage: true },
        },
      },
    })

    // Defender PDS fires Space Cannon Defense; force 1 hit onto the attacker.
    t.advanceTo('GROUND_COMBAT', { attacker: 1 })

    // Converge routes the hit to the mech, sparing the infantry.
    expect(t.attacker.units.MECH).toBeUndefined()
    expect(t.attacker.units.INFANTRY).toHaveLength(2)
  })

  it('Space Cannon Defense falls back to other ground forces without mechs', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'AVARICE_REX',
        units: { INFANTRY: 2 },
      },
      defender: {
        faction: 'AVARICE_REX',
        units: { PDS: 1, INFANTRY: 1 },
        abilities: {
          TF_CONVERGE: true,
          SPACE_CANNON_DEFENSE: { isEnabled: true, disableSustainDamage: true },
        },
      },
    })

    t.advanceTo('GROUND_COMBAT', { attacker: 1 })

    expect(t.attacker.units.INFANTRY).toHaveLength(1)
  })
})
