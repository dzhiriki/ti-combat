import { describe, expect, it } from 'vitest'

import { CombatEngine } from '@/combat'
import { buildCombatState } from '@/hooks/combat-setup/build-combat-state'

import { combatTest } from '../utils/combat-test'

function summarizeOutcomes(attackerGalvanized: boolean): {
  attacker: number
  defender: number
  draw: number
} {
  const state = buildCombatState({
    system: 'TI4',
    mode: 'GROUND',
    attacker: {
      faction: 'BARONY_OF_LETNEV',
      units: { FLAGSHIP: 1, INFANTRY: 1 },
      abilities: attackerGalvanized
        ? {
            PRE_GALVANIZED: {
              isEnabled: true,
              galvanizedUnits: [['FLAGSHIP', 1]],
              reinforcementTokens: 7,
            },
          }
        : {},
    },
    defender: { faction: 'ARBOREC', units: { INFANTRY: 1 } },
  })
  const outcomes = new CombatEngine().simulate(state)
  const result = { attacker: 0, defender: 0, draw: 0 }
  for (const o of outcomes) result[o.winner] += o.probability
  return result
}

describe('GALVANIZED Arc Secundus bombardment', () => {
  it('base flagship rolls 3 bombardment dice at 5+', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'BARONY_OF_LETNEV',
        units: { FLAGSHIP: 1, INFANTRY: 1 },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 2 } },
    })

    t.advanceTo('GROUND_COMBAT')
    const pool = t.dicePool(0)
    expect(pool.hitSource).toBe('BOMBARDMENT')
    expect(pool.attacker).toContainDice('FLAGSHIP', [5, 3])
  })

  it('galvanized flagship rolls 4 bombardment dice at 5+', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'BARONY_OF_LETNEV',
        units: { FLAGSHIP: 1, INFANTRY: 1 },
        abilities: {
          PRE_GALVANIZED: {
            isEnabled: true,
            galvanizedUnits: [['FLAGSHIP', 1]],
            reinforcementTokens: 7,
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 1 } },
    })

    t.advanceTo('GROUND_COMBAT')
    const pool = t.dicePool(0)
    expect(pool.hitSource).toBe('BOMBARDMENT')
    expect(pool.attacker).toContainDice('FLAGSHIP', [5, 4])
  })

  it('galvanizing the flagship strictly increases attacker win probability', () => {
    const base = summarizeOutcomes(false)
    const galv = summarizeOutcomes(true)
    expect(galv.attacker).toBeGreaterThan(base.attacker)
  })
})
