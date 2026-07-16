import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('TF_DIVINITY', () => {
  it('saves a unit from destruction during space combat', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { CRUISER: 1 },
        abilities: { TF_DIVINITY: true },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 1 })

    // The 1 incoming hit is cancelled → the lone cruiser survives
    expect(t.abilityLog('TF_DIVINITY')).not.toHaveLength(0)
    expect(t.attacker.units.CRUISER).toHaveLength(1)
  })

  it('also saves a unit during ground combat', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'AVARICE_REX',
        units: { INFANTRY: 1 },
        abilities: { TF_DIVINITY: true },
      },
      defender: { faction: 'AVARICE_REX', units: { INFANTRY: 2 } },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound({ attacker: 1 })

    expect(t.abilityLog('TF_DIVINITY')).not.toHaveLength(0)
    expect(t.attacker.units.INFANTRY).toHaveLength(1)
  })
})
