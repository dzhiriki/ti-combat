import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('TF_LASH', () => {
  it('destroys an equal-or-lower-cost enemy unit when your unit is destroyed', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { CRUISER: 1 },
        abilities: { TF_LASH: true },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT')
    // Attacker's lone cruiser dies, defender takes no combat hits — so any
    // defender loss is Lash's doing.
    t.advanceRound({ attacker: 1, defender: 0 })

    expect(t.abilityLog('TF_LASH')).not.toHaveLength(0)
    expect(t.attacker.units.CRUISER ?? []).toHaveLength(0)
    // Cruiser cost (2) ≤ destroyed cruiser cost (2) → one defender cruiser dies
    expect(t.defender.units.CRUISER).toHaveLength(1)
  })

  it('does not fire when no eligible (cheap enough) target exists', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { FIGHTER: 1 },
        abilities: { TF_LASH: true },
      },
      // War Sun (cost 12) is far more expensive than a fighter (0.5)
      defender: { faction: 'AVARICE_REX', units: { WAR_SUN: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 1, defender: 0 })

    expect(t.abilityLog('TF_LASH')).toHaveLength(0)
    expect(t.defender.units.WAR_SUN).toHaveLength(1)
  })
})
