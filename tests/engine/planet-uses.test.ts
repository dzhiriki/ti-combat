import { describe, expect, it } from 'vitest'

import { type Ability, CombatEngine, type CombatOutcome } from '@/combat'
import { CombatSideState } from '@/combat/combat-side-state/combat-side-state'
import {
  buildCombatState,
  type SideConfig,
} from '@/hooks/combat-setup/build-combat-state'

import { combatTest } from '../utils/combat-test'
import { PLANET_1, PLANET_2, TWO_PLANET_INVASION } from '../utils/surface-units'

const placements = {
  [PLANET_1]: { INFANTRY: 1 },
  [PLANET_2]: { INFANTRY: 1 },
}

const side = (abilities: SideConfig['abilities'] = {}): SideConfig => ({
  faction: 'FEDERATION_OF_SOL',
  units: {},
  placements,
  abilities,
})

function moraleBoost(uses: number, planetUses: [string, number][] = []) {
  return { MORALE_BOOST: { isEnabled: true, uses, planetUses } }
}

/** Morale Boost uses the attacker has at each planet's first round. */
function usesPerPlanet(abilities: SideConfig['abilities']): number[] {
  const t = combatTest({
    ...TWO_PLANET_INVASION,
    attacker: side(abilities),
    defender: side(),
  })
  const uses = () =>
    CombatSideState.getLiveParams(t.state.attacker, 'MORALE_BOOST')
      ?.uses as number
  const seen: number[] = []
  t.advanceTo('GROUND_COMBAT')
  seen.push(uses())
  t.advanceRound({ defender: 1 })
  t.advanceTo('GROUND_COMBAT')
  seen.push(uses())
  return seen
}

/** Records the `uses` its invokes see at every planet's START_OF_COMBAT. */
function recordUses(seen: number[]): Ability {
  return {
    key: 'TEST_RECORD_USES',
    name: 'Record uses',
    side: 'attacker',
    params: { isEnabled: true, uses: 3 },
    invoke: [
      {
        timing: 'START_OF_COMBAT',
        isCallable: params => {
          seen.push(params.uses)
          return false
        },
        call: () => {},
      },
    ],
  }
}

/** Spends a use in Space Cannon Defense, recording the planet. */
function fireOnDefense(planets: string[]): Ability {
  return {
    key: 'TEST_FIRE_ON_DEFENSE',
    name: 'Fire on defense',
    side: 'defender',
    params: { isEnabled: true, uses: 1 },
    invoke: [
      {
        timing: 'SPACE_CANNON_DEFENSE_STEP',
        call: ctx => {
          planets.push(ctx.state.activeSurfaceId)
        },
      },
    ],
  }
}

/** The attacker's chance to win `planet`. */
function winOdds(
  abilities: SideConfig['abilities'],
  planet: string = PLANET_1,
): number {
  const outcomes: CombatOutcome[] = new CombatEngine().simulate(
    buildCombatState({
      system: 'TI4',
      ...TWO_PLANET_INVASION,
      attacker: side(abilities),
      defender: side(),
    }),
  )
  expect(outcomes.reduce((sum, o) => sum + o.probability, 0)).toBeCloseTo(1, 10)
  return outcomes
    .filter(o => o.planetWinners?.[planet] === 'attacker')
    .reduce((sum, o) => sum + o.probability, 0)
}

describe('planet uses', () => {
  it('lets a later planet spend what a capped planet left', () => {
    expect(usesPerPlanet(moraleBoost(3, [[PLANET_1, 1]]))).toEqual([1, 2])
  })

  it('holds every use back from a planet capped at zero', () => {
    expect(usesPerPlanet(moraleBoost(3, [[PLANET_1, 0]]))).toEqual([0, 3])
  })

  it('caps a later planet below what is left', () => {
    expect(usesPerPlanet(moraleBoost(3, [[PLANET_2, 1]]))).toEqual([3, 1])
  })

  it('leaves uses unlimited without caps', () => {
    expect(usesPerPlanet(moraleBoost(3))).toEqual([3, 2])
    const cs = buildCombatState({
      system: 'TI4',
      ...TWO_PLANET_INVASION,
      attacker: side(moraleBoost(3)),
      defender: side(),
    })
    expect(cs.data.planetUses).toBeUndefined()
  })

  it("gives invokes the planet's limit as their uses", () => {
    const seen: number[] = []
    const t = combatTest({
      ...TWO_PLANET_INVASION,
      attacker: side({ TEST_RECORD_USES: { planetUses: [[PLANET_1, 1]] } }),
      defender: side({ TEST_RECORD_USES: { isEnabled: false } }),
      customAbilities: [recordUses(seen)],
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound({ defender: 1 })
    t.advanceTo('GROUND_COMBAT')
    t.advanceRound({ defender: 1 })

    expect(seen).toEqual([1, 3])
  })

  it("counts a planet's Space Cannon Defense toward its cap", () => {
    const fired = (planetUses: [string, number][]) => {
      const planets: string[] = []
      const t = combatTest({
        ...TWO_PLANET_INVASION,
        attacker: side({ TEST_FIRE_ON_DEFENSE: { isEnabled: false } }),
        defender: side({ TEST_FIRE_ON_DEFENSE: { planetUses } }),
        customAbilities: [fireOnDefense(planets)],
      })
      t.advanceTo('GROUND_COMBAT')
      return planets
    }

    expect(fired([])).toEqual([PLANET_1])
    expect(fired([[PLANET_1, 0]])).toEqual([PLANET_2])
  })

  it("changes a capped planet's odds", () => {
    const free = winOdds(moraleBoost(1))
    const held = winOdds(moraleBoost(1, [[PLANET_1, 0]]))

    expect(held).toBeLessThan(free)
  })

  it('plays the uses an earlier planet left on a later one', () => {
    // Planet 1 runs out of uses at its cap; the held-back use must still
    // fire on planet 2, so both planets fight with one boost.
    const boosted = winOdds(moraleBoost(1))
    const caps: [string, number][] = [
      [PLANET_1, 1],
      [PLANET_2, 1],
    ]

    expect(winOdds(moraleBoost(2, caps), PLANET_1)).toBeCloseTo(boosted, 10)
    expect(winOdds(moraleBoost(2, caps), PLANET_2)).toBeCloseTo(boosted, 10)
  })
})
