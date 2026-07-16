import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('TF_ATOMIZE', () => {
  it('destroys all ships in the system when your flagship is destroyed', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { FLAGSHIP: 1 },
        abilities: { TF_ATOMIZE: true },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 3 } },
    })

    t.advanceTo('SPACE_COMBAT')
    // Flagship (Sustain) takes 2 hits → sustains then dies → Atomize fires
    t.advanceRound({ attacker: 2 })

    expect(t.abilityLog('TF_ATOMIZE')).not.toHaveLength(0)
    expect(t.attacker.units.FLAGSHIP).toBeUndefined()
    // All defender ships wiped out by Atomize
    expect(t.defender.units.CRUISER).toBeUndefined()
  })

  it('does not fire while the flagship survives', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { FLAGSHIP: 1, CRUISER: 1 },
        abilities: { TF_ATOMIZE: true },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT')
    // Only the cruiser takes a hit; flagship lives
    t.advanceRound({ attacker: 1 })

    expect(t.abilityLog('TF_ATOMIZE')).toHaveLength(0)
    expect(t.attacker.units.FLAGSHIP).toHaveLength(1)
  })
})
