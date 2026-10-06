import type { CombatSide } from '@/types'

import type { SideStateData } from '../../combat-state/types'
import type { CombatWinner } from '../../types'

/**
 * Outcome with probability relative to reaching the node.
 * Stores compact state references instead of extracted survivors —
 * extraction is deferred to outcomeRecordToArray (once per unique outcome).
 *
 * `winnerSide` is required: every leaf reaches this struct via
 * `makeLeafOutcome`, which guarantees it is set (combat completion paths
 * always set it; the maxRounds escape hatch computes it from current units).
 */
export interface RelativeOutcome {
  attackerData: SideStateData
  defenderData: SideStateData
  probability: number
  winnerSide: CombatSide | 'draw'
  /** Multi-planet invasions: each planet's winner by surface id;
   *  `winnerSide` is then the combined result. */
  planetWinners: Record<string, CombatWinner> | undefined
}

export type OutcomeRecord = Map<string, RelativeOutcome>
