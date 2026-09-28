/** State of a single surviving unit */
interface SurvivorUnit {
  isDamaged?: boolean
  subtypes?: string[]
}

/** Surviving units for one side, grouped by unit type */
export type SurvivorSide = Partial<Record<string, SurvivorUnit[]>>

/** Surviving units for one side, grouped first by surface id. */
export type SurfaceSurvivors = Record<string, SurvivorSide>

/** Result of one combat. */
export type CombatWinner = 'attacker' | 'defender' | 'draw'

/** Final combat outcome with full survivor info */
export interface CombatOutcome {
  /** Aggregate kept for consumers that display a single combined list. */
  attacker: SurvivorSide
  defender: SurvivorSide
  attackerSurfaces: SurfaceSurvivors
  defenderSurfaces: SurfaceSurvivors
  /** With several invaded planets: attacker or defender only when that side
   *  won every planet's combat, otherwise draw. */
  winner: CombatWinner
  /** Multi-planet invasions: each planet's ground-combat winner, keyed by
   *  surface id in resolution order. */
  planetWinners?: Record<string, CombatWinner>
  probability: number
}

/** Probability of each combat result across a set of outcomes. */
export interface CombatResult {
  attackerWin: number
  draw: number
  defenderWin: number
}
