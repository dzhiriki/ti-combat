import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

// Cloak reuses Solar Flare's implementation (key SOLAR_FLARE), so it blocks the
// opponent's Space Cannon Offense against your ships.
describe('SOLAR_FLARE', () => {
  it('Cloak blocks opponent Space Cannon Offense in Twilight’s Fall', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { CRUISER: 2 },
        abilities: { SOLAR_FLARE: true },
      },
      defender: { faction: 'AVARICE_REX', units: { PDS: 1, CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')

    // PDS Space Cannon Offense is suppressed by Cloak
    expect(t.dicePool()?.defender?.PDS).toBeUndefined()
  })
})
