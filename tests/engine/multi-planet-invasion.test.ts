import { describe, expect, it } from 'vitest'

import {
  type Ability,
  cloneStateForBranch,
  CombatEngine,
  type CombatOutcome,
  CombatState,
  type DicePool,
} from '@/combat'
import {
  buildCombatState,
  type CombatStateConfig,
  type SideConfig,
} from '@/hooks/combat-setup/build-combat-state'
import type { SurfaceDefinition, SurfaceId } from '@/types'
import { SPACE_SURFACE_ID } from '@/types'

import { combatTest } from '../utils/combat-test'
import { getSurfaceUnitIds } from '../utils/surface-units'

const P1 = 'planet-1' as SurfaceId
const P2 = 'planet-2' as SurfaceId
const SURFACES: SurfaceDefinition[] = [
  { id: SPACE_SURFACE_ID, type: 'SPACE', name: 'Space' },
  { id: P1, type: 'PLANET', name: 'Planet 1' },
  { id: P2, type: 'PLANET', name: 'Planet 2' },
]

const side = (placements: SideConfig['placements']): SideConfig => ({
  faction: 'FEDERATION_OF_SOL',
  units: {},
  placements,
})

function invasion(
  attacker: SideConfig['placements'],
  defender: SideConfig['placements'],
  extra: Partial<CombatStateConfig> = {},
) {
  return {
    mode: 'GROUND' as const,
    surfaces: SURFACES,
    invasionPlanets: [P1, P2],
    attacker: side(attacker),
    defender: side(defender),
    ...extra,
  }
}

function simulate(config: Omit<CombatStateConfig, 'system'>): CombatOutcome[] {
  return new CombatEngine().simulate(
    buildCombatState({ system: 'TI4', ...config }),
  )
}

function odds(
  outcomes: CombatOutcome[],
  winnerOf: (outcome: CombatOutcome) => string | undefined,
): Record<string, number> {
  const result: Record<string, number> = {}
  for (const o of outcomes) {
    const winner = winnerOf(o) ?? 'none'
    result[winner] = (result[winner] ?? 0) + o.probability
  }
  return result
}

function spaceCannonPools(log: ReturnType<typeof combatTest>['log']) {
  return log
    .filter(entry => entry.path.at(-1) === 'DICE_POOL')
    .map(entry => entry.data?.[0] as { defender: DicePool; hitSource: string })
    .filter(pool => pool.hitSource === 'SPACE_CANNON' && pool.defender.PDS)
}

/** Counts its START_OF_COMBAT calls in its own config. */
const countStarts: Ability = {
  key: 'TEST_COUNT_STARTS',
  name: 'Count starts',
  side: 'attacker',
  params: { isEnabled: true, uses: Infinity, starts: 0 },
  invoke: [
    {
      timing: 'START_OF_COMBAT',
      call: (ctx, params) =>
        ctx.api.own.updateAbilityConfig({
          starts: (params.starts as number) + 1,
        }),
    },
  ],
}

/** Upgrades the attacker's infantry once, when the first combat ends. */
const upgradeInfantry: Ability = {
  key: 'TEST_UPGRADE_INFANTRY',
  name: 'Upgrade infantry',
  side: 'attacker',
  params: { isEnabled: true, uses: 1 },
  invoke: [
    {
      timing: 'END_OF_COMBAT',
      call: ctx => ctx.api.own.modifyUnitType('INFANTRY', { COMBAT: [3, 1] }),
    },
  ],
}

describe('multi-planet invasion', () => {
  it('commits every ground force in space to the first planet', () => {
    const t = combatTest(
      invasion(
        { [SPACE_SURFACE_ID]: { INFANTRY: 2 }, [P2]: { INFANTRY: 1 } },
        { [P1]: { INFANTRY: 1 }, [P2]: { INFANTRY: 1 } },
      ),
    )

    t.advanceTo('GROUND_COMBAT')

    expect(t.state.activeSurfaceId).toBe(P1)
    expect(getSurfaceUnitIds(t.state.attacker, SPACE_SURFACE_ID)).toHaveLength(
      0,
    )
    expect(getSurfaceUnitIds(t.state.attacker, P1)).toHaveLength(2)
    expect(getSurfaceUnitIds(t.state.attacker, P2)).toHaveLength(1)
    expect(t.state.attacker.participatingUnits).toHaveLength(2)
  })

  it('resolves Space Cannon Defense on every planet before ground combat', () => {
    const t = combatTest(
      invasion(
        { [SPACE_SURFACE_ID]: { INFANTRY: 2 }, [P2]: { INFANTRY: 1 } },
        {
          [P1]: { INFANTRY: 1, PDS: 1 },
          [P2]: { INFANTRY: 1, PDS: 1 },
        },
      ),
    )

    t.advanceTo('GROUND_COMBAT', { attacker: 1 })

    expect(spaceCannonPools(t.log)).toHaveLength(2)
    expect(getSurfaceUnitIds(t.state.attacker, P1)).toHaveLength(1)
    expect(getSurfaceUnitIds(t.state.attacker, P2)).toHaveLength(0)
    expect(t.state.activeSurfaceId).toBe(P1)
  })

  it('skips Space Cannon Defense on a planet without committed forces', () => {
    const t = combatTest(
      invasion(
        { [SPACE_SURFACE_ID]: { INFANTRY: 1 } },
        { [P1]: { INFANTRY: 1 }, [P2]: { INFANTRY: 1, PDS: 1 } },
      ),
    )

    t.advanceTo('GROUND_COMBAT')

    expect(spaceCannonPools(t.log)).toHaveLength(0)
  })

  it('fights each planet as its own combat, in order', () => {
    const t = combatTest(
      invasion(
        { [P1]: { INFANTRY: 1 }, [P2]: { INFANTRY: 1 } },
        { [P1]: { INFANTRY: 1 }, [P2]: { INFANTRY: 1 } },
        { customAbilities: [countStarts] },
      ),
    )

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound({ defender: 1 })

    expect(t.state.invasion?.results).toEqual(['attacker'])
    expect(t.isFinished()).toBe(false)

    t.advanceTo('GROUND_COMBAT')
    expect(t.state.activeSurfaceId).toBe(P2)
    expect(t.state.attacker.participatingUnits).toHaveLength(1)

    t.advanceRound({ attacker: 1 })

    expect(t.isFinished()).toBe(true)
    expect(t.state.invasion?.results).toEqual(['attacker', 'defender'])
    expect(t.state.attacker.abilities.TEST_COUNT_STARTS.starts).toBe(2)
    expect(getSurfaceUnitIds(t.state.attacker, P1)).toHaveLength(1)
    expect(getSurfaceUnitIds(t.state.defender, P2)).toHaveLength(1)
  })

  it('carries ability uses into the next planet', () => {
    const run = (uses: number) => {
      const t = combatTest(
        invasion(
          { [P1]: { INFANTRY: 1 }, [P2]: { INFANTRY: 1 } },
          { [P1]: { INFANTRY: 1 }, [P2]: { INFANTRY: 1 } },
          {
            attacker: {
              ...side({ [P1]: { INFANTRY: 1 }, [P2]: { INFANTRY: 1 } }),
              abilities: { MORALE_BOOST: { isEnabled: true, uses } },
            },
          },
        ),
      )
      const played: number[] = []
      t.advanceTo('GROUND_COMBAT')
      t.advanceRound({ defender: 1 })
      played.push(t.state.attacker.abilities.MORALE_BOOST.uses as number)
      t.advanceTo('GROUND_COMBAT')
      t.advanceRound({ defender: 1 })
      played.push(t.state.attacker.abilities.MORALE_BOOST.uses as number)
      return played
    }

    expect(run(2)).toEqual([1, 0])
    expect(run(1)).toEqual([0, 0])
  })

  it('carries unit stat changes into the next planet', () => {
    const t = combatTest(
      invasion(
        { [P1]: { INFANTRY: 1 }, [P2]: { INFANTRY: 1 } },
        { [P1]: { INFANTRY: 1 }, [P2]: { INFANTRY: 1 } },
        { customAbilities: [upgradeInfantry] },
      ),
    )

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound({ defender: 1 })
    expect(t.dicePool().attacker).toContainDice('INFANTRY', [7, 1])

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound({ defender: 1 })
    expect(t.dicePool().attacker).toContainDice('INFANTRY', [3, 1])
  })

  it('matches independent single-planet combats', () => {
    const planet1 = { attacker: { INFANTRY: 2 }, defender: { INFANTRY: 1 } }
    const planet2 = { attacker: { INFANTRY: 1 }, defender: { INFANTRY: 2 } }
    const outcomes = simulate(
      invasion(
        { [P1]: planet1.attacker, [P2]: planet2.attacker },
        { [P1]: planet1.defender, [P2]: planet2.defender },
      ),
    )
    const alone = (
      planet: SurfaceId,
      units: typeof planet1,
    ): Record<string, number> =>
      odds(
        simulate({
          mode: 'GROUND',
          surfaces: SURFACES,
          activeSurfaceId: planet,
          attacker: side({ [planet]: units.attacker }),
          defender: side({ [planet]: units.defender }),
        }),
        o => o.winner,
      )

    expect(outcomes.reduce((sum, o) => sum + o.probability, 0)).toBeCloseTo(
      1,
      10,
    )
    for (const o of outcomes) {
      expect(Object.keys(o.planetWinners ?? {})).toEqual([P1, P2])
    }
    const first = alone(P1, planet1)
    const second = alone(P2, planet2)
    const firstOdds = odds(outcomes, o => o.planetWinners?.[P1])
    const secondOdds = odds(outcomes, o => o.planetWinners?.[P2])
    for (const winner of ['attacker', 'defender', 'draw']) {
      expect(firstOdds[winner] ?? 0).toBeCloseTo(first[winner] ?? 0, 10)
      expect(secondOdds[winner] ?? 0).toBeCloseTo(second[winner] ?? 0, 10)
    }
    const combined = odds(outcomes, o => o.winner)
    expect(combined.attacker).toBeCloseTo(first.attacker * second.attacker, 10)
    expect(combined.defender).toBeCloseTo(first.defender * second.defender, 10)
  })

  it('leaves a planet without an attacker to the defender', () => {
    const outcomes = simulate(
      invasion(
        { [SPACE_SURFACE_ID]: { INFANTRY: 2 } },
        { [P1]: { INFANTRY: 1 }, [P2]: { INFANTRY: 1 } },
      ),
    )

    for (const o of outcomes) {
      expect(o.planetWinners?.[P2]).toBe('defender')
      expect(o.winner).not.toBe('attacker')
    }
  })

  it('keeps the single-planet path for one invaded planet', () => {
    const config = {
      mode: 'GROUND' as const,
      surfaces: SURFACES,
      activeSurfaceId: P2,
      attacker: side({ [SPACE_SURFACE_ID]: { INFANTRY: 2 } }),
      defender: side({ [P2]: { INFANTRY: 1 } }),
    }
    const plain = simulate(config)

    expect(simulate({ ...config, invasionPlanets: [P2] })).toEqual(plain)
    expect(plain.every(o => o.planetWinners === undefined)).toBe(true)
  })

  it('tells planets apart in the state hash', () => {
    const cs = buildCombatState({
      system: 'TI4',
      ...invasion(
        { [P1]: { INFANTRY: 1 }, [P2]: { INFANTRY: 1 } },
        { [P1]: { INFANTRY: 1 }, [P2]: { INFANTRY: 1 } },
      ),
    })
    const fork = CombatState.fromDataStandalone(cloneStateForBranch(cs.data))
    fork.data.invasion = { ...fork.data.invasion!, results: ['attacker'] }

    expect(fork.getHash()).not.toBe(cs.getHash())
    expect(fork.getUnitsHash()).not.toBe(cs.getUnitsHash())
  })
})
