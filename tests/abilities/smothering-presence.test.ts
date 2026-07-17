import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('TF_SMOTHERING_PRESENCE', () => {
  it('opponent units lose Sustain Damage', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { CRUISER: 1 },
        abilities: { TF_SMOTHERING_PRESENCE: true },
      },
      defender: { faction: 'AVARICE_REX', units: { DREADNOUGHT: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ defender: 1 })

    // The dreadnought could not sustain — 1 hit destroys it outright
    expect(t.defender.units.DREADNOUGHT).toBeUndefined()
  })

  it('opponent units lose Space Cannon', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { CRUISER: 2 },
        abilities: { TF_SMOTHERING_PRESENCE: true },
      },
      defender: { faction: 'AVARICE_REX', units: { PDS: 1, CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    expect(t.dicePool()?.defender?.PDS).toBeUndefined()
  })

  it('opponent destroyers lose Anti-Fighter Barrage', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { FIGHTER: 2 },
        abilities: { TF_SMOTHERING_PRESENCE: true },
      },
      defender: { faction: 'AVARICE_REX', units: { DESTROYER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    // No AFB dice were rolled against the fighters
    expect(t.dicePool()?.defender?.DESTROYER).toBeUndefined()
  })
})
