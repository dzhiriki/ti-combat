import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('TF_SUPERCHARGE', () => {
  it('applies +2 to exactly one unit of the chosen type', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { CRUISER: 2 },
        abilities: {
          TF_SUPERCHARGE: { isEnabled: true, unitType: 'CRUISER' },
        },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()
    const pool = t.dicePool()

    // One cruiser boosted: 7 - 2 = 5; the other stays at base 7
    expect(pool.attacker).toContainDice('CRUISER', [5, 1])
    expect(pool.attacker).toContainDice('CRUISER', [7, 1])
  })

  it('applies in ground combat too', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'AVARICE_REX',
        units: { INFANTRY: 2 },
        abilities: {
          TF_SUPERCHARGE: { isEnabled: true, unitType: 'INFANTRY' },
        },
      },
      defender: { faction: 'AVARICE_REX', units: { INFANTRY: 1 } },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound()
    const pool = t.dicePool()

    // Infantry base 8 → boosted one hits on 6
    expect(pool.attacker).toContainDice('INFANTRY', [6, 1])
    expect(pool.attacker).toContainDice('INFANTRY', [8, 1])
  })
})
