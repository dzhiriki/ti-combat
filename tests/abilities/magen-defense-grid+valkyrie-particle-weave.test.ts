import { describe, expect, it } from 'vitest'

import { CombatEngine } from '@/combat'
import { buildCombatState } from '@/hooks/combat-setup/build-combat-state'

import { combatTest } from '../utils/combat-test'

describe('MAGEN_DEFENSE_GRID + VALKYRIE_PARTICLE_WEAVE', () => {
  it('VPW does not fire when dice produce 0 hits despite MDG hit', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'SARDAKK_NORR',
        units: { INFANTRY: 3 },
        abilities: { VALKYRIE_PARTICLE_WEAVE: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 2, PDS: 1 },
        abilities: { MAGEN_DEFENSE_GRID: true },
      },
    })

    t.advanceTo('GROUND_COMBAT')
    // 0 total hits from dice — no hits on Sardakk from dice roll
    t.advanceRound(0)

    // MDG should still fire (it's at START_OF_COMBAT, independent of dice)
    expect(t.abilityLog('MAGEN_DEFENSE_GRID')).not.toHaveLength(0)
    // VPW should NOT fire — VPW checks dice roll hits, not MDG hits
    expect(t.abilityLog('VALKYRIE_PARTICLE_WEAVE')).toHaveLength(0)
  })

  it('MDG wins with 100% probability when it destroys the last unit before VPW can fire', () => {
    const state = buildCombatState({
      system: 'TI4',
      mode: 'GROUND',
      attacker: {
        faction: 'SARDAKK_NORR',
        units: { INFANTRY: 1 },
        abilities: { VALKYRIE_PARTICLE_WEAVE: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { INFANTRY: 1, SPACE_DOCK: 1 },
        abilities: { MAGEN_DEFENSE_GRID: true },
      },
    })

    const outcomes = new CombatEngine().simulate(state)
    const defenderWinProbability = outcomes
      .filter(outcome => outcome.winner === 'defender')
      .reduce((total, outcome) => total + outcome.probability, 0)

    expect(defenderWinProbability).toBe(1)
  })
})
