import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('TF_SPARK', () => {
  it('destroys a ship that used Sustain Damage in space combat', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { CRUISER: 1 },
        abilities: { TF_SPARK: { uses: 1 } },
      },
      defender: { faction: 'AVARICE_REX', units: { DREADNOUGHT: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ defender: 1 })

    // Dreadnought sustained then was destroyed by Spark
    expect(t.defender.units.DREADNOUGHT).toBeUndefined()
  })

  it('destroys a mech that used Sustain Damage in ground combat', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'AVARICE_REX',
        units: { INFANTRY: 4 },
        abilities: { TF_SPARK: { uses: 1 } },
      },
      // Avarice mech (Delver) has Sustain Damage
      defender: { faction: 'AVARICE_REX', units: { MECH: 1 } },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound({ defender: 1 })

    // Mech sustained then was destroyed by Spark — proves ground-combat use
    expect(t.defender.units.MECH).toBeUndefined()
  })

  it('cannot destroy a Spark-immune dreadnought upgrade', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { CRUISER: 1 },
        abilities: { TF_SPARK: { uses: 1 } },
      },
      defender: {
        faction: 'AVARICE_REX',
        units: { DREADNOUGHT: 1 },
        abilities: { TF_UPGRADE_SUPER_DREADNOUGHT: true },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ defender: 1 })

    // Upgraded dreadnought sustains normally — immune to Spark
    expect(t.defender.units.DREADNOUGHT).toHaveLength(1)
    expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBe(true)
  })
})
