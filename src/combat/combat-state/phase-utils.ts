import type { CombatMode, MetaPhase, PhaseTransitionTarget } from './types'

/**
 * The ordered sequence of meta-phases for space combat.
 * Combat proceeds through these phases in order.
 */
export const SPACE_FLOW: readonly MetaPhase[] = [
  'SPACE_CANNON_OFFENSE',
  'SPACE_COMBAT',
] as const

/**
 * The ordered sequence of meta-phases for ground combat.
 * Combat proceeds through these phases in order.
 */
export const GROUND_FLOW: readonly MetaPhase[] = [
  'BOMBARDMENT',
  'COMMIT_UNITS',
  'SPACE_CANNON_DEFENSE',
  'GROUND_COMBAT',
] as const

/** Return the flow array for a combat mode. */
export function getFlow(mode: CombatMode): readonly MetaPhase[] {
  return mode === 'SPACE' ? SPACE_FLOW : GROUND_FLOW
}

/**
 * Return the next meta-phase that follows `current` in the flow, or
 * `'COMPLETE'` when `current` is the final flow entry or unrecognized.
 * Combat metas (SPACE_COMBAT / GROUND_COMBAT) do NOT loop — the engine
 * handles round looping by re-entering the same meta when its script
 * drains and units remain.
 */
export function getNextPhaseInFlow(
  current: MetaPhase,
  mode: CombatMode,
): PhaseTransitionTarget {
  const flow = getFlow(mode)
  const currentMetaIndex = flow.indexOf(current)

  if (currentMetaIndex === -1) return 'COMPLETE'

  return flow[currentMetaIndex + 1] ?? 'COMPLETE'
}

/** Get the initial meta-phase for a combat mode. */
export function getInitialMetaPhase(mode: CombatMode): MetaPhase {
  return getFlow(mode)[0]
}

/** True when this meta loops (re-runs its script each round until one side
 *  is wiped or a retreat triggers completion). */
export function isCombatMeta(meta: MetaPhase): boolean {
  return meta === 'SPACE_COMBAT' || meta === 'GROUND_COMBAT'
}

/** The looping combat meta of a combat mode. */
export function getCombatMeta(mode: CombatMode): MetaPhase {
  return mode === 'SPACE' ? 'SPACE_COMBAT' : 'GROUND_COMBAT'
}
