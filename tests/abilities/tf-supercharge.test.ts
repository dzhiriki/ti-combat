import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('TF_SUPERCHARGE', () => {
  it('applies +2 to exactly one unit of the preferred type', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { CRUISER: 2 },
        abilities: {
          TF_SUPERCHARGE: { isEnabled: true, spacePriority: [['CRUISER']] },
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

  it('falls through to the next priority when the preferred type is gone', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { CRUISER: 1, DESTROYER: 1 },
        abilities: {
          TF_SUPERCHARGE: {
            isEnabled: true,
            spacePriority: [['DESTROYER'], ['CRUISER']],
          },
        },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT')
    // Round 1: destroyer is boosted (9 → 7), then dies to the incoming hit
    t.advanceRound({ attacker: 1 })
    expect(t.dicePool().attacker).toContainDice('DESTROYER', [7, 1])
    expect(t.attacker.units.DESTROYER).toBeUndefined()

    // Round 2: the bonus moves to the cruiser (7 → 5)
    t.advanceRound()
    expect(t.dicePool().attacker).toContainDice('CRUISER', [5, 1])
  })

  it('applies in ground combat too', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'GROUND',
      attacker: {
        faction: 'AVARICE_REX',
        units: { INFANTRY: 2 },
        abilities: {
          TF_SUPERCHARGE: { isEnabled: true, groundPriority: [['INFANTRY']] },
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
