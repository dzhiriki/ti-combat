/** State of a single surviving unit */
interface SurvivorUnit {
  isDamaged?: boolean
  subtypes?: string[]
}

/** Surviving units for one side, grouped by unit type */
export type SurvivorSide = Partial<Record<string, SurvivorUnit[]>>

/** Surviving units for one side, grouped first by surface id. */
export type SurfaceSurvivors = Record<string, SurvivorSide>

/** Final combat outcome with full survivor info */
export interface CombatOutcome {
  /** Aggregate kept for consumers that display a single combined list. */
  attacker: SurvivorSide
  defender: SurvivorSide
  attackerSurfaces: SurfaceSurvivors
  defenderSurfaces: SurfaceSurvivors
  winner: 'attacker' | 'defender' | 'draw'
  probability: number
}
