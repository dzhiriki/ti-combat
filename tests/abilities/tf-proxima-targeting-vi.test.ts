import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('TF_PROXIMA_TARGETING_VI', () => {
  it('cancels 1 hit from a Bombardment roll', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'AVARICE_REX',
        units: { DREADNOUGHT: 1, INFANTRY: 1 },
      },
      defender: {
        faction: 'AVARICE_REX',
        units: { INFANTRY: 2 },
        abilities: { TF_PROXIMA_TARGETING_VI: true },
      },
    })

    // Pick the bombardment branch producing 1 hit on the defender — Proxima
    // cancels it, so both infantry survive into ground combat.
    t.advanceTo('GROUND_COMBAT', { defender: 1 })

    expect(t.abilityLog('TF_PROXIMA_TARGETING_VI')).not.toHaveLength(0)
    expect(t.defender.units.INFANTRY).toHaveLength(2)
  })

  it('resolves Bombardment 7(x3) against both sides at the start of a ground round', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'AVARICE_REX',
        units: { INFANTRY: 3 },
        abilities: {
          TF_PROXIMA_TARGETING_VI: {
            isEnabled: true,
            resolveBombardment: true,
          },
        },
      },
      defender: {
        faction: 'AVARICE_REX',
        units: { INFANTRY: 3 },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound()

    // The merged self + opponent roll resolves as a BOMBARDMENT group
    expect(t.dicePool(-2).hitSource).toBe('BOMBARDMENT')
    expect(t.abilityLog('TF_PROXIMA_TARGETING_VI')).not.toHaveLength(0)
  })
})
