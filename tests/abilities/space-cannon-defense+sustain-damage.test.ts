import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('SPACE_CANNON_DEFENSE + SUSTAIN_DAMAGE', () => {
  it('committed ground force sustains an SCD hit by default', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: { faction: 'SARDAKK_NORR', units: { MECH: 2 } },
      defender: { faction: 'ARBOREC', units: { PDS: 1, INFANTRY: 1 } },
    })

    // Defender PDS fires Space Cannon Defense; force 1 hit onto the attacker
    // (and 0 bombardment hits onto the defender).
    t.advanceTo('GROUND_COMBAT', { attacker: 1 })

    // Both mechs survive; one used Sustain Damage.
    expect(t.attacker.units.MECH).toHaveLength(2)
    expect(t.attacker.units.MECH!.some(m => m.isDamaged)).toBe(true)
  })

  it('committed ground force cannot sustain an SCD hit when disableSustainDamage is on', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: { faction: 'SARDAKK_NORR', units: { MECH: 2 } },
      defender: {
        faction: 'ARBOREC',
        units: { PDS: 1, INFANTRY: 1 },
        abilities: { SPACE_CANNON_DEFENSE: { disableSustainDamage: true } },
      },
    })

    t.advanceTo('GROUND_COMBAT', { attacker: 1 })

    // One mech destroyed (no sustain); survivor undamaged.
    expect(t.attacker.units.MECH).toHaveLength(1)
    expect(t.attacker.units.MECH![0].isDamaged).toBeFalsy()
  })

  it('uses the defender outgoing priority as the eligibility list', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'SARDAKK_NORR',
        units: { MECH: 1, INFANTRY: 1 },
      },
      defender: {
        faction: 'ARBOREC',
        units: { PDS: 1, INFANTRY: 1 },
        abilities: {
          SPACE_CANNON_DEFENSE: {
            customPriority: true,
            unitPriority: [['INFANTRY']],
            disableSustainDamage: true,
          },
        },
      },
    })

    t.advanceTo('GROUND_COMBAT', { attacker: 1 })

    expect(t.attacker.units.INFANTRY).toBeUndefined()
    expect(t.attacker.units.MECH).toHaveLength(1)
  })
})
