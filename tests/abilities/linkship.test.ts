import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('TF_UPGRADE_LINKSHIP', () => {
  it('destroys an opponent ship without Sustain Damage when it retreats', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { DESTROYER: 1, CRUISER: 1 },
        abilities: {
          RETREAT: { isEnabled: true, rounds: 1 },
          TF_UPGRADE_LINKSHIP: true,
        },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 3 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    // The retreating Linkship destroys one defender cruiser (no Sustain)
    expect(t.defender.units.CRUISER).toHaveLength(2)
  })
})
