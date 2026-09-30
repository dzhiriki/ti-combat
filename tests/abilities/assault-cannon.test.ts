import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('ASSAULT_CANNON ', () => {
  it.each([false, true])(
    'excludes fighters and uncommitted ground forces from the threshold (galvanized: %s)',
    galvanized => {
      const t = combatTest({
        mode: 'SPACE',
        attacker: {
          faction: 'ARBOREC',
          units: { CRUISER: 2, FIGHTER: 3, MECH: 2 },
          abilities: {
            ASSAULT_CANNON: true,
            PRE_GALVANIZED: {
              isEnabled: galvanized,
              galvanizedUnits: [['FIGHTER', 3]],
            },
          },
        },
        defender: { faction: 'ARBOREC', units: { CRUISER: 2 } },
      })

      t.advanceTo('AFB')

      expect(t.abilityLog('ASSAULT_CANNON')).toHaveLength(0)
      expect(t.defender.units.CRUISER).toHaveLength(2)
    },
  )

  it('Defender assault cannon does not trigger in 3v3 situation', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
        abilities: { ASSAULT_CANNON: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 3 },
        abilities: { ASSAULT_CANNON: true },
      },
    })

    t.advanceTo('AFB')

    expect(t.attacker.units.CRUISER).toHaveLength(3)
    expect(t.defender.units.CRUISER).toHaveLength(2)
  })
})
