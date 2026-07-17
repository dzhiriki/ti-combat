import { describe, expect, it } from 'vitest'

import { combatTest, unitsByBaseType } from '../utils/combat-test'

describe('TF genomes', () => {
  it('Mirror Genome blocks opponent Space Cannon Offense', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { CRUISER: 2 },
        abilities: { TF_MIRROR_GENOME: true },
      },
      defender: { faction: 'AVARICE_REX', units: { PDS: 1, CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    expect(t.dicePool()?.defender?.PDS).toBeUndefined()
  })

  it('Splitting Genome places 2 fighters when your cruiser is destroyed', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { CRUISER: 1 },
        abilities: { TF_SPLITTING_GENOME: true },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 1, defender: 0 })

    // Attacker's lone cruiser dies → 2 fighters appear
    expect(t.attacker.units.FIGHTER).toHaveLength(2)
  })

  it('Temporal Genome (Thundarian reuse) restarts a bad roll for a TF faction', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { CRUISER: 2 },
        abilities: {
          THUNDARIAN: {
            isEnabled: true,
            uses: 1,
            combinator: 'OR',
            ownStrategyKind: 'IF_HITS_AMOUNT_LE',
            ownStrategyThreshold: 0,
            opponentStrategyKind: 'NEVER',
            opponentStrategyThreshold: 0,
          },
        },
      },
      defender: { faction: 'AVARICE_REX', units: { CARRIER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    expect(t.abilityLog('THUNDARIAN')).not.toHaveLength(0)
  })

  it('Valiant Genome rolls 1 die against the opponent when your unit dies', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { CRUISER: 1 },
        abilities: { TF_VALIANT_GENOME: true },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 1 } },
    })

    t.advanceToTiming(
      'BEFORE_ASSIGN_HITS',
      { attacker: 1, defender: 0 },
      'SPACE_COMBAT',
    )
    const branches = t.step()

    const byRemaining: Record<number, number> = {}
    for (const b of branches) {
      const count = unitsByBaseType(b.state.data.defender).CRUISER?.length ?? 0
      byRemaining[count] = (byRemaining[count] ?? 0) + b.probability
    }
    // Cruiser combat 7 → die ≥7 = 0.4 destroys the defender cruiser
    expect(byRemaining[0]).toBeCloseTo(0.4)
    expect(byRemaining[1]).toBeCloseTo(0.6)
  })
})
