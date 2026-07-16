import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('TF_HARDLIGHT', () => {
  it('cancels up to 2 hits during space combat', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { CRUISER: 3 },
        abilities: { TF_HARDLIGHT: { uses: 1 } },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 3 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 3 })

    // 3 hits - 2 cancelled = 1 effective → 2 cruisers survive
    expect(t.abilityLog('TF_HARDLIGHT')).not.toHaveLength(0)
    expect(t.attacker.units.CRUISER).toHaveLength(2)
  })

  it('also cancels hits during ground combat (broader window than Shields Holding)', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'AVARICE_REX',
        units: { INFANTRY: 3 },
        abilities: { TF_HARDLIGHT: { uses: 1 } },
      },
      defender: { faction: 'AVARICE_REX', units: { INFANTRY: 3 } },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound({ attacker: 2 })

    // 2 hits - 2 cancelled = 0 effective → all 3 infantry survive
    expect(t.abilityLog('TF_HARDLIGHT')).not.toHaveLength(0)
    expect(t.attacker.units.INFANTRY).toHaveLength(3)
  })
})
