import {
  type AbilityTiming,
  CombatState,
  type CombatStateData,
  type DicePool,
  getInitialMetaPhase,
  type HitSource,
  isCombatMeta,
  type LogEntry,
  Logger,
  type MetaPhase,
  parseVariantId,
  type PhaseTransitionTarget,
  type SideStateData,
  type StateWithProbability,
} from '@/combat'
import {
  buildCombatState,
  type CombatStateConfig,
  type SideConfig,
} from '@/hooks/combat-setup/build-combat-state'
import type {
  CombatSide,
  GameSystem,
  UnitBaseType,
  UnitId,
  UnitIdList,
  UnitState,
} from '@/types'
import { DEFAULT_GAME_SYSTEM } from '@/utils/get-game-data'

import { shuffleInPlace } from './shuffle'

export type { SideConfig }
// Test shorthand only: production builders require an explicit game system.
export type CombatTestConfig = Omit<CombatStateConfig, 'system'> & {
  system?: GameSystem
}

// ============================================================================
// REVERSED MODE (for forEachSide tests)
// ============================================================================

let _reversed = false

export function setReversed(value: boolean) {
  _reversed = value
}

const swapSide = (s: CombatSide): CombatSide =>
  s === 'attacker' ? 'defender' : 'attacker'

/** Return a CombatStateData whose per-side `abilities` reflects the live
 *  overlay merged on top of the base config, so tests reading
 *  `t.state.<side>.abilities.<key>.<field>` see current values for fields
 *  mutated during the run (uses, reinforcementTokens, etc.). */
function mergeLiveAbilitiesView(state: CombatStateData): CombatStateData {
  const mergeSide = (
    side: Record<string, Record<string, unknown>>,
    live: Record<string, Record<string, unknown>>,
  ): Record<string, Record<string, unknown>> => {
    const liveKeys = Object.keys(live)
    if (liveKeys.length === 0) return side
    const result = { ...side }
    for (const key of liveKeys) {
      result[key] = result[key] ? { ...result[key], ...live[key] } : live[key]
    }
    return result
  }
  return {
    ...state,
    attacker: {
      ...state.attacker,
      abilities: mergeSide(
        state.attacker.abilities,
        state.attacker.liveAbilities,
      ),
    },
    defender: {
      ...state.defender,
      abilities: mergeSide(
        state.defender.abilities,
        state.defender.liveAbilities,
      ),
    },
  }
}

// ============================================================================
// HITS SPEC
// ============================================================================

export type HitsSpec = number | { attacker?: number; defender?: number }

// ============================================================================
// SIDE VIEW (reconstructs units for test assertions)
// ============================================================================

type TestUnit = UnitState & { subtypes?: string[] }

type SideView = Omit<
  SideStateData,
  | 'participatingUnits'
  | 'nonParticipatingUnits'
  | 'unitType'
  | 'unitState'
  | 'unitStats'
> & {
  units: Partial<Record<UnitBaseType, TestUnit[]>>
}

function buildSideView(data: SideStateData): SideView {
  const {
    unitState,
    unitStats,
    participatingUnits,
    nonParticipatingUnits,
    unitType,
    ...rest
  } = data
  void unitStats
  const result: Partial<Record<UnitBaseType, TestUnit[]>> = {}

  const collect = (pool: UnitIdList) => {
    for (const id of pool) {
      const key = unitType[id]
      if (!key) continue
      const { type, subtypes } = parseVariantId(key)
      const arr = result[type] ?? (result[type] = [])
      const state = unitState[id]
      const unit: TestUnit = { ...state }
      if (subtypes.length > 0) unit.subtypes = subtypes
      arr.push(unit)
    }
  }
  collect(participatingUnits)
  collect(nonParticipatingUnits)

  return { ...rest, units: result }
}

export function unitsByBaseType(
  sideData: SideStateData,
): Partial<Record<UnitBaseType, UnitId[]>> {
  const result: Partial<Record<UnitBaseType, UnitId[]>> = {}
  const collect = (pool: UnitIdList) => {
    for (const id of pool) {
      const key = sideData.unitType[id]
      if (!key) continue
      const { type } = parseVariantId(key)
      const arr = result[type] ?? (result[type] = [])
      arr.push(id as UnitId)
    }
  }
  collect(sideData.participatingUnits)
  collect(sideData.nonParticipatingUnits)
  return result
}

// ============================================================================
// COMBAT TEST CLASS
// ============================================================================

export class CombatTest {
  private _cs: CombatState
  private _state: CombatStateData
  private _log: LogEntry[] = []
  /** Rounds start at 0 (no combat-meta round entered yet) and bump to 1
   *  the first time we load a SPACE_COMBAT / GROUND_COMBAT script. */
  private _round = 0
  private _reversed: boolean
  /** Active meta-phase — test harness owns the flow variable. */
  private _currentMeta: MetaPhase
  /** Phase whose script was last loaded. Used to distinguish initial entry
   *  (no script loaded for current phase yet — load it) from script-drained
   *  (need to transition to next phase). */
  private _loadedForPhase: MetaPhase | null = null

  constructor(combatState: CombatState, reversed = false) {
    this._state = combatState.data
    this._reversed = reversed
    this._cs = combatState
    this._currentMeta = getInitialMetaPhase(this._state.combatMode)
  }

  // --- Meta access ---

  get meta(): MetaPhase {
    return this._currentMeta
  }

  // --- Reversed mode helpers ---

  private _side(side: CombatSide): CombatSide {
    return this._reversed ? swapSide(side) : side
  }

  private _mapHits(hits: HitsSpec): HitsSpec {
    if (!this._reversed || typeof hits === 'number') return hits
    return { attacker: hits.defender, defender: hits.attacker }
  }

  // --- State access ---

  get state(): CombatStateData {
    const merged = mergeLiveAbilitiesView(this._state)
    if (!this._reversed) return merged
    return {
      ...merged,
      attacker: merged.defender,
      defender: merged.attacker,
    }
  }

  get attacker(): SideView {
    return buildSideView(this._state[this._side('attacker')])
  }

  get defender(): SideView {
    return buildSideView(this._state[this._side('defender')])
  }

  get log(): LogEntry[] {
    return this._log
  }

  isFinished(): boolean {
    return this._cs.isFinished()
  }

  // --- Phase control ---

  advanceTo(meta: PhaseTransitionTarget, hits: HitsSpec = 0): this {
    const MAX_ITERATIONS = 500
    const stopAt =
      meta === 'COMPLETE'
        ? undefined
        : (step: import('@/combat').PhaseStep) =>
            step.phase[step.phase.length - 1] === meta

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      if (meta === 'COMPLETE') {
        if (this._cs.isFinished()) break
        if (!this._ensureScriptLoaded()) break
      } else {
        if (!this._ensureScriptLoaded()) break
        const top = this._cs.peekStep()
        if (top && top.phase[top.phase.length - 1] === meta) break
        if (this._currentMeta === meta) break
      }

      this._cs._logger = Logger.create()
      const outcomes = this._cs.advance(false, stopAt)
      const best = pickOutcomeByHits(outcomes, this._mapHits(hits))
      this._adoptOutcome(best)
    }

    return this
  }

  /** Advance until the next pending step is a timing step with the given
   *  timing. Stops BEFORE that timing fires, so assertions can inspect the
   *  state produced by all prior steps (unit-ability dice rolls, hit
   *  assignment, nested metas like AFB, etc.). Hits apply to branching
   *  events encountered along the way. When `meta` is provided, the stop
   *  additionally requires `currentPhase` to match — useful when the same
   *  timing fires in multiple metas (e.g. BEFORE_ASSIGN_HITS in SCO, AFB,
   *  SPACE_COMBAT).
   *
   *  If the current top step already matches the target timing (e.g. the
   *  previous `advanceToTiming` call stopped at a matching step), the
   *  first iteration advances past it so consecutive calls target
   *  successive occurrences of the same timing. */
  advanceToTiming(
    timing: AbilityTiming,
    hits: HitsSpec = 0,
    meta?: MetaPhase,
  ): this {
    const MAX_ITERATIONS = 500
    const matches = (step: import('@/combat').PhaseStep) =>
      step.kind === 'timing' &&
      step.timing === timing &&
      (meta === undefined || step.phase[step.phase.length - 1] === meta)

    let skippedInitial = false

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      if (!this._ensureScriptLoaded()) break

      const top = this._cs.peekStep()
      if (!top) break
      if (skippedInitial && matches(top)) break

      this._cs._logger = Logger.create()
      const outcomes = this._cs.advance(false, step => {
        if (!skippedInitial) {
          skippedInitial = true
          return false
        }
        return matches(step)
      })
      const best = pickOutcomeByHits(outcomes, this._mapHits(hits))
      this._adoptOutcome(best)
    }

    return this
  }

  advanceRound(hits: HitsSpec = 0): this {
    const MAX_ITERATIONS = 500

    const stopAtCombat = (step: import('@/combat').PhaseStep) =>
      isCombatMeta(step.phase[step.phase.length - 1])

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      if (this._cs.isFinished()) return this
      if (!this._ensureScriptLoaded()) return this
      if (isCombatMeta(this._currentMeta)) break

      this._cs._logger = Logger.create()
      const outcomes = this._cs.advance(false, stopAtCombat)
      const best = pickOutcomeByHits(outcomes, this._mapHits(hits))
      this._adoptOutcome(best)
    }

    const entryRound = this._round
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      if (this._cs.isFinished()) break
      if (!this._ensureScriptLoaded()) break
      if (this._round > entryRound) break

      this._cs._logger = Logger.create()
      const outcomes = this._cs.advance()
      const best = pickOutcomeByHits(outcomes, this._mapHits(hits))
      this._adoptOutcome(best)
    }

    return this
  }

  /** Mirror `combat-state.advance()` — call the underlying advance once and
   *  return its outcomes. Runs until the first branching point or until the
   *  current script drains. Loads the next phase script when the stack is
   *  empty, so consecutive calls walk forward across phase boundaries the
   *  way combat-engine does at runtime.
   *
   *  Single-outcome (deterministic) results are adopted as the harness's
   *  current state and their log entries are captured into `t.log`.
   *  Branches are returned to the caller without adoption — the harness
   *  tracks only one state, so the caller drives each branch via
   *  `branch.state.advance()` directly. */
  advance(): StateWithProbability[] {
    const MAX_ITERATIONS = 500
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      if (this._cs.isFinished()) return [{ state: this._cs, probability: 1 }]
      if (!this._ensureScriptLoaded()) {
        return [{ state: this._cs, probability: 1 }]
      }
      this._cs._logger = Logger.create()
      const outcomes = this._cs.advance()
      if (outcomes.length > 1 || outcomes[0].probability !== 1) {
        return outcomes
      }
      // Deterministic — the current phase script drained without branching.
      // Adopt the resulting state (captures logs, syncs `_cs`) and loop so
      // `_ensureScriptLoaded` transitions to the next phase. This is what
      // makes `advance()` keep walking past empty phases (e.g. SCO with no
      // PDS) until it reaches a real branching point.
      this._adoptOutcome(outcomes[0])
    }
    return [{ state: this._cs, probability: 1 }]
  }

  /** Advance until the next branching event, drain boundary, completion, or
   *  meta transition (AFB nesting). With step-atomic advance(), individual
   *  steps are often deterministic — callers of `step()` want the next
   *  decision point. After branching, each branch is driven through any
   *  in-flight ability pass + subsequent deterministic steps until it sits
   *  at the same stable point. */
  step(round?: number): StateWithProbability[] {
    const prevRound = this._round
    if (round !== undefined) this._round = round
    try {
      const entryMeta = this._currentMeta
      const MAX_ITERATIONS = 500
      for (let i = 0; i < MAX_ITERATIONS; i++) {
        if (!this._ensureScriptLoaded()) break

        this._cs._logger = Logger.create()
        const outcomes = this._cs.advance(false, step => {
          return step.phase[step.phase.length - 1] !== entryMeta
        })

        if (outcomes.length > 1 || outcomes[0].probability !== 1) {
          return this._driveBranchesToStable(outcomes)
        }
        this._adoptOutcome(outcomes[0])
        const top = this._cs.peekStep()
        if (!top || top.phase[top.phase.length - 1] !== entryMeta) {
          return [{ state: this._cs, probability: 1 }]
        }
        if (this._cs.pendingSteps.length === 0) {
          return [{ state: this._cs, probability: 1 }]
        }
      }
      return [{ state: this._cs, probability: 1 }]
    } finally {
      this._round = prevRound
    }
  }

  /** If the script for the current phase has not been loaded yet, load it.
   *  If the script has drained, ask combat-state for the next phase. Combat
   *  phases repeat only while both sides can enter them; exhausted flow loads
   *  the normal end-of-combat timings. */
  private _ensureScriptLoaded(): boolean {
    if (this._cs.isFinished()) return false
    if (this._cs.pendingSteps.length > 0) return true

    if (this._loadedForPhase === this._currentMeta) {
      const next = this._cs.getNextPhase(this._currentMeta)
      if (next === 'COMPLETE') {
        this._cs.loadEndScript(this._currentMeta)
        return true
      }
      this._currentMeta = next
    }
    if (isCombatMeta(this._currentMeta)) {
      this._round++
    }
    this._cs.loadPhaseScript(this._currentMeta, this._round)
    this._loadedForPhase = this._currentMeta
    return this._cs.pendingSteps.length > 0
  }

  /** For each branch produced by a branching step, drive its state through
   *  in-flight ability-pass resume + deterministic steps until either (a)
   *  it reaches a stable point (empty pending ability pass AND the next
   *  step would leave the current micro), or (b) it branches again. Old
   *  phase-atomic tests expect every branch to have completed AFTER_DICE_ROLL
   *  / destroy-cascade work before inspection. */
  private _driveBranchesToStable(
    outcomes: StateWithProbability[],
  ): StateWithProbability[] {
    const result: StateWithProbability[] = []
    for (const { state, probability } of outcomes) {
      for (const leaf of driveBranchToStable(state)) {
        result.push({
          state: leaf.state,
          probability: probability * leaf.probability,
        })
      }
    }
    return result
  }

  /** Adopt a branch outcome as the new current state. The returned
   *  CombatState owns `pendingSteps` for the continuation. */
  private _adoptOutcome(best: StateWithProbability): void {
    this._cs = best.state
    this._state = best.state.data
    if (best.state.log) this._log.push(...best.state.log)
  }

  // --- Log query methods ---

  abilityLog(key: string, side?: CombatSide): LogEntry[] {
    const mappedSide =
      side !== undefined && this._reversed ? swapSide(side) : side
    return this._log.filter(entry => {
      if (!entry.path.includes(key)) return false
      if (mappedSide !== undefined && entry.side !== mappedSide) return false
      return true
    })
  }

  /** Return a DICE_POOL entry's payload. Indexing follows `Array.prototype.at`
   *  semantics: `0` is the first pool, `-1` (default) is the last, negative
   *  values count from the end. Out-of-range indices yield an empty pool. */
  dicePool(index: number = -1): {
    attacker: DicePool
    defender: DicePool
    hitSource?: HitSource
  } {
    const pools: {
      attacker: DicePool
      defender: DicePool
      hitSource?: HitSource
    }[] = []
    for (const entry of this._log) {
      if (entry.path[entry.path.length - 1] !== 'DICE_POOL') continue
      if (!entry.data) continue
      const data = entry.data[0] as {
        attacker: DicePool
        defender: DicePool
        hitSource?: HitSource
      }
      pools.push(data)
    }

    const data = pools.at(index)
    if (!data) return { attacker: {}, defender: {} }
    if (this._reversed) {
      return {
        attacker: data.defender,
        defender: data.attacker,
        hitSource: data.hitSource,
      }
    }
    return {
      attacker: data.attacker,
      defender: data.defender,
      hitSource: data.hitSource,
    }
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/** Drive one branch forward synchronously: resume any in-flight ability pass
 *  until it resolves (or branches further, recursively). The branch is
 *  considered stable once the pass stack empties — callers can then
 *  inspect ability-produced state like inline-assigned hits and decremented
 *  `uses`. Re-splits into further branches when abilities branch again
 *  (e.g., Ambush → then Assault Cannon fires per-branch). */
function driveBranchToStable(
  state: import('@/combat').CombatState,
): StateWithProbability[] {
  const leaves: StateWithProbability[] = []
  const frontier: StateWithProbability[] = [{ state, probability: 1 }]
  while (frontier.length > 0) {
    const { state: s, probability: p } = frontier.pop()!
    if (s.isFinished() || !hasParkedPass(s)) {
      leaves.push({ state: s, probability: p })
      continue
    }
    // Stop as soon as the parked pass drains — under looped advance, a plain
    // advance() would keep going into subsequent steps (e.g. DICE_ROLL) and
    // produce extra branches the caller didn't ask for.
    const outcomes = s.advance(false, () => !hasParkedPass(s))
    for (const o of outcomes) {
      frontier.push({ state: o.state, probability: p * o.probability })
    }
  }
  return leaves
}

/** Extract raw dice hits from the last DICE_HITS log entry for an outcome */
function getDiceHits(
  outcome: StateWithProbability,
): { attacker: number; defender: number } | undefined {
  const log = outcome.state.log
  if (!log) return undefined
  for (let i = log.length - 1; i >= 0; i--) {
    const entry = log[i]
    if (entry.path[entry.path.length - 1] === 'DICE_HITS' && entry.data) {
      return entry.data[0] as { attacker: number; defender: number }
    }
  }
  return undefined
}

/** Pick the outcome matching the requested hit spec (raw dice, pre-abilities) */
function pickOutcomeByHits(
  outcomes: StateWithProbability[],
  hits: HitsSpec,
): StateWithProbability {
  if (outcomes.length === 1) return outcomes[0]

  const match = outcomes.find(outcome => {
    const diceHits = getDiceHits(outcome)
    if (!diceHits) return false

    if (typeof hits === 'number') {
      return diceHits.attacker + diceHits.defender === hits
    }

    const wantAttacker = hits.attacker ?? 0
    const wantDefender = hits.defender ?? 0
    return (
      diceHits.attacker === wantAttacker && diceHits.defender === wantDefender
    )
  })

  if (!match) {
    const available = outcomes.map(o => {
      const d = getDiceHits(o)
      return d ? `{a:${d.attacker},d:${d.defender}}` : '{no dice}'
    })
    const hitsStr =
      typeof hits === 'number'
        ? `${hits} total`
        : `{a:${hits.attacker ?? 0},d:${hits.defender ?? 0}}`
    throw new Error(
      `No outcome with ${hitsStr} hits. Available: [${available.join(', ')}]`,
    )
  }

  return match
}

/** True when any timing step on `pendingSteps` has a parked ability-pass
 *  `frame`. Used by the test harness to drive branched states forward
 *  until every in-flight pass has drained. */
export function hasParkedPass(state: CombatState): boolean {
  for (const s of state.pendingSteps) {
    if (s.kind === 'group') {
      for (const inner of s.steps) {
        if (inner.kind === 'timing' && inner.frame) return true
      }
    } else if (s.kind === 'timing' && s.frame) {
      return true
    }
  }
  return false
}

/** Transition from the given meta to the next one and load its script.
 *  Exhausted flow loads end-of-combat timings and returns `null`. */
export function transitionAndLoad(
  state: CombatState,
  currentMeta: MetaPhase,
  round: number,
): MetaPhase | null {
  if (state.isFinished()) return null
  const next = state.getNextPhase(currentMeta)
  if (next === 'COMPLETE') {
    state.loadEndScript(currentMeta)
    return null
  }
  state.loadPhaseScript(next, round)
  return next
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function combatTest(config: CombatTestConfig): CombatTest {
  const system = config.system ?? DEFAULT_GAME_SYSTEM
  const reversed = _reversed
  const effectiveConfig = reversed
    ? { ...config, attacker: config.defender, defender: config.attacker }
    : config
  // Shuffle iteration order for order-independence testing. Must happen
  // before forSimulation so `buildInvokes` (and the subsequent PREPARE
  // pass) sees the shuffled order — matching the production setup path
  // exactly. ABILITY_ORDER arrays are NOT shuffled — they represent
  // intentional ordering set by tests to control resolution priority
  // within a timing.
  return new CombatTest(
    buildCombatState({
      ...effectiveConfig,
      system,
      prepareAbilities: ({ attacker, defender }) => {
        shuffleInPlace(attacker)
        shuffleInPlace(defender)
      },
    }),
    reversed,
  )
}
