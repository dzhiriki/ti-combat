import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('TF_FEINT + TF_UPGRADE_LINKSHIP', () => {
  it('a Linkship retreating via Feint still destroys an eligible ship', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { DESTROYER: 1 },
        abilities: {
          TF_UPGRADE_LINKSHIP: true,
          RETREAT: { isEnabled: true, rounds: 1 },
          TF_FEINT: true,
        },
      },
      // Cruiser has no Sustain Damage → eligible Linkship target.
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    // The retreat fired at the announcement, and the WHEN_RETREAT trigger
    // still reached the Linkship text.
    expect(t.isFinished()).toBe(true)
    expect(t.defender.units.CRUISER).toHaveLength(1)
    expect(t.abilityLog('TF_UPGRADE_LINKSHIP')).not.toHaveLength(0)
  })
})
