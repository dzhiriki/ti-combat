import type { CombatOutcome, CombatResult } from '@/combat'
import type { SurfaceDefinition } from '@/types'

import { getCombatResult } from './get-combat-result'

export interface PlanetReport {
  surface: SurfaceDefinition
  result: CombatResult
  /** Outcomes seen from this planet: its winner and its survivors only. */
  outcomes: CombatOutcome[]
}

/** One report per invaded planet, in tab order; empty unless the outcomes
 *  come from a multi-planet invasion. */
export function getPlanetReports(
  outcomes: readonly CombatOutcome[],
  surfaces: readonly SurfaceDefinition[],
): PlanetReport[] {
  const winners = outcomes[0]?.planetWinners
  if (!winners) return []
  return surfaces
    .filter(surface => surface.id in winners)
    .map(surface => {
      const planetOutcomes = outcomes.map(o => {
        const attacker = o.attackerSurfaces[surface.id] ?? {}
        const defender = o.defenderSurfaces[surface.id] ?? {}
        return {
          attacker,
          defender,
          attackerSurfaces: { [surface.id]: attacker },
          defenderSurfaces: { [surface.id]: defender },
          winner: o.planetWinners?.[surface.id] ?? 'draw',
          probability: o.probability,
        }
      })
      return {
        surface,
        result: getCombatResult(planetOutcomes),
        outcomes: planetOutcomes,
      }
    })
}
