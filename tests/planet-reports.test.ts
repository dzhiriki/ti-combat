import { describe, expect, it } from 'vitest'

import type { CombatOutcome } from '@/combat'
import type { SurfaceDefinition, SurfaceId } from '@/types'
import { SPACE_SURFACE_ID } from '@/types'
import { getCombatResult } from '@/utils/get-combat-result'
import { getPlanetReports } from '@/utils/get-planet-reports'

const P1 = 'planet-1' as SurfaceId
const P2 = 'planet-2' as SurfaceId
const SURFACES: SurfaceDefinition[] = [
  { id: SPACE_SURFACE_ID, type: 'SPACE', name: 'Space' },
  { id: P1, type: 'PLANET', name: 'Planet 1' },
  { id: P2, type: 'PLANET', name: 'Planet 2' },
]

const infantry = (count: number) => ({
  INFANTRY: Array.from({ length: count }, () => ({})),
})

function outcome(
  winners: Record<string, CombatOutcome['winner']>,
  winner: CombatOutcome['winner'],
  probability: number,
): CombatOutcome {
  return {
    attacker: { ...infantry(2), CRUISER: [{}] },
    defender: infantry(1),
    attackerSurfaces: {
      [SPACE_SURFACE_ID]: { CRUISER: [{}] },
      [P1]: infantry(2),
      [P2]: {},
    },
    defenderSurfaces: { [SPACE_SURFACE_ID]: {}, [P1]: {}, [P2]: infantry(1) },
    winner,
    planetWinners: winners,
    probability,
  }
}

describe('planet reports', () => {
  const outcomes = [
    outcome({ [P1]: 'attacker', [P2]: 'defender' }, 'draw', 0.75),
    outcome({ [P1]: 'attacker', [P2]: 'attacker' }, 'attacker', 0.25),
  ]

  it('sums outcome probabilities by winner', () => {
    expect(getCombatResult(outcomes)).toEqual({
      attackerWin: 0.25,
      draw: 0.75,
      defenderWin: 0,
    })
  })

  it('projects outcomes onto each invaded planet', () => {
    const [first, second] = getPlanetReports(outcomes, SURFACES)

    expect(first.surface.id).toBe(P1)
    expect(first.result).toEqual({ attackerWin: 1, draw: 0, defenderWin: 0 })
    expect(first.outcomes[0].attacker).toEqual(infantry(2))
    expect(Object.keys(first.outcomes[0].attackerSurfaces)).toEqual([P1])
    expect(second.surface.id).toBe(P2)
    expect(second.result).toEqual({
      attackerWin: 0.25,
      draw: 0,
      defenderWin: 0.75,
    })
    expect(second.outcomes[0].defender).toEqual(infantry(1))
  })

  it('has no reports for a single-planet combat', () => {
    const single = outcomes.map(o => ({ ...o, planetWinners: undefined }))
    expect(getPlanetReports(single, SURFACES)).toEqual([])
  })
})
