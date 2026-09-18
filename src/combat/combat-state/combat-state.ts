import { GROUND_FORCES, STRUCTURES } from '@/constants/units'
import type {
  CombatSide,
  DiceGroup,
  SurfaceDefinition,
  SurfaceId,
  UnitAbility,
  UnitBaseType,
  UnitId,
  UnitType,
} from '@/types'

import {
  AbilitiesEngine,
  type AbilityBranch,
  AbilityBranchInterrupt,
  type AbilityCandidate,
  cloneSideInvokes,
  cloneTracker,
  type DicePool,
  type InvokeCollections,
} from '../abilities-engine'
import { AbilityContext } from '../abilities-engine/api/ability-api'
import { returnCommittedFighters } from '../abilities-engine/api/commit-fighters'
import { extractDefaults } from '../abilities-engine/declare-param'
import type {
  AbilitiesOverride,
  Ability,
  RegisteredAbility,
} from '../abilities-engine/types'
import { CombatSideState } from '../combat-side-state/combat-side-state'
import type {
  DiceMathBranch,
  PendingEffect,
} from '../dice-math/branch-accumulator'
import { runDiceMath } from '../dice-math/run-dice-math'
import type {
  HitValueModifierDecl,
  RollTriggerDecl,
  SideDiceCollection,
} from '../dice-math/types'
import { marginalizeBaseHits } from '../dice-math/utils/marginalize-base-hits'
import { type LogEntry, Logger } from '../logger'
import { canonicalizeUnitState } from '../utils/canonicalize-unit-state'
import { sortUnitsByPriority } from '../utils/sort-units-by-priority'
import {
  isNativeCategory,
  participatesInCombat,
} from '../utils/unit-combat-properties'
import type {
  CombatMode,
  CombatStateData,
  DiceRollContext,
  HitSource,
  MetaPhase,
  PendingStep,
  PhaseStep,
  PhaseStepGroup,
  SideStateData,
  UnitAbilityMeta,
  UnitTargetFilter,
} from './types'
import { isDiceRollContext } from './types'

/** A state with its probability */
export interface StateWithProbability {
  state: CombatState
  probability: number
}

/** Innermost meta in a phase stack. Used for logger children, hit-value
 *  modifier scoping, and unit-ability config selection — they all key on the
 *  most deeply nested meta (e.g. 'AFB' when the stack is ['SPACE_COMBAT', 'AFB']). */
function innerMeta(phase: MetaPhase[]): MetaPhase {
  return phase[phase.length - 1]
}

/** Extract `UnitType[]` keys from a `UnitList<V>` tuple-array, dropping
 *  entries whose value slot is explicitly `false` (checkbox-mode "off").
 *  Number-mode entries are kept regardless of count — sortUnitsByPriority
 *  consumers care about ordering, not magnitude. */
function unwrapUnitListKeys(raw: unknown): UnitType[] {
  if (!Array.isArray(raw)) return raw as UnitType[]
  if (raw.length === 0) return raw as UnitType[]
  if (!Array.isArray(raw[0])) return raw as UnitType[]
  const result: UnitType[] = []
  for (const entry of raw as readonly [string, ...unknown[]][]) {
    if (entry.length >= 2 && entry[1] === false) continue
    result.push(entry[0] as UnitType)
  }
  return result
}

function sortUnitsAtSetup(data: CombatStateData): void {
  const mode = data.combatMode
  for (const side of ['attacker', 'defender'] as const) {
    // Saved and live priority lists control order; membership is derived
    // independently from native categories and instance grants.
    const baseSide = data[side].abilities
    const liveSide = data[side].liveAbilities

    const baseUP = baseSide['UNIT_PRIORITY']
    const liveUP = liveSide['UNIT_PRIORITY']
    const unitPriority = (
      liveUP === undefined
        ? baseUP
        : baseUP === undefined
          ? liveUP
          : { ...baseUP, ...liveUP }
    ) as
      | { spaceUnitPriority?: UnitType[]; groundUnitPriority?: UnitType[] }
      | undefined

    const rawList =
      mode === 'GROUND'
        ? unitPriority?.groundUnitPriority
        : unitPriority?.spaceUnitPriority
    const list = rawList ? unwrapUnitListKeys(rawList) : []

    sortUnitsByPriority(data[side], list, id =>
      participatesInCombat(data[side], id, mode, data.activeSurfaceId),
    )
  }
}

interface UnitAbilityPhaseConfig {
  firing: CombatSide[]
  hitSource: HitSource
  allowedUnitTypes?: ReadonlySet<UnitBaseType>
  sourceSurfaceIds?: ReadonlySet<SurfaceId>
}

/** AFB-context AFTER_UNIT_ABILITY_ROLL abilities (e.g. RAID_FORMATION) need
 *  to read excess-hit counts; clamping would hide them. Gate per-side. */
function hasAfbAfterRollInvokes(
  invokes: InvokeCollections,
  side: CombatSide,
): boolean {
  return !!invokes[side].get('AFB')?.get('AFTER_UNIT_ABILITY_ROLL')?.length
}

/** Main combat state class */
export class CombatState {
  data!: CombatStateData
  _logger?: Logger
  private _params!: AbilitiesEngine
  private _collapseThreshold?: number
  public _invokes!: InvokeCollections
  /** Per-side ownership flag for CoW of `_invokes`. Mutating one side
   *  (e.g. via `removeUnitInvokes`) only triggers a clone of THAT side's
   *  `SideInvokes`, leaving the opposite side's reference shared with the
   *  parent state. Avoids 7-bucket `cloneSideInvokes` allocations on the
   *  uninvolved side during DESTROY cleanup. */
  public _invokesOwned: { attacker: boolean; defender: boolean } = {
    attacker: true,
    defender: true,
  }
  public _allInvokes!: Record<CombatSide, AbilityCandidate[]>
  public _allInvokesOwned = true
  /** LIFO stack of steps for the current meta's phase script. `advance()`
   *  pops one step per call. Stored in reverse execution order so `.pop()`
   *  yields the next-to-execute step. Instance-level (not on `data`) because
   *  steps hold direct method references that can't go through structuredClone.
   *
   *  Entries are either standalone `PhaseStep`s or `PhaseStepGroup`s whose
   *  inner steps share a context (e.g. the destroyed-units map driving a
   *  DESTROY / WHEN_DESTROY / AFTER_DESTROY cascade). Inside a group, the
   *  innermost step at `steps.at(-1)` is the next to execute; when the
   *  group's steps drain, the group is removed and its context released. */
  public pendingSteps: PendingStep[] = []

  /** The timing step currently dispatching a `runAbilities` pass, or
   *  `undefined` outside a dispatch (PREPARE, tests, between steps). Derived
   *  from `pendingSteps` by walking from the top and returning the innermost
   *  timing step — skipping groups whose innermost pending step is a method
   *  (e.g. a freshly-pushed dice-roll group whose `_collectDice` hasn't run
   *  yet). Exposed so the abilities engine can read the phase stack and
   *  park-state slot without plumbing them through its public API. */
  get currentStep(): Extract<PhaseStep, { kind: 'timing' }> | undefined {
    for (let i = this.pendingSteps.length - 1; i >= 0; i--) {
      const entry = this.pendingSteps[i]
      const step = entry.kind === 'group' ? entry.steps.at(-1) : entry
      if (step?.kind === 'timing') return step
    }
    return undefined
  }

  get log(): LogEntry[] | undefined {
    return this._logger?.entries as LogEntry[] | undefined
  }

  ensureOwnInvokes(side?: CombatSide): void {
    if (side === undefined) {
      this.ensureOwnInvokes('attacker')
      this.ensureOwnInvokes('defender')
      return
    }
    if (!this._invokesOwned[side]) {
      this._invokes = {
        ...this._invokes,
        [side]: cloneSideInvokes(this._invokes[side]),
      }
      this._invokesOwned[side] = true
    }
  }

  ensureOwnAllInvokes(): void {
    if (!this._allInvokesOwned) {
      this._allInvokes = {
        attacker: [...this._allInvokes.attacker],
        defender: [...this._allInvokes.defender],
      }
      this._allInvokesOwned = true
    }
  }

  get combatMode(): CombatMode {
    return this.data.combatMode
  }

  get params(): AbilitiesEngine {
    return this._params
  }

  /** Create CombatState for simulation */
  static forSimulation(
    attacker: SideStateData,
    defender: SideStateData,
    combatMode: CombatMode,
    surfaces: SurfaceDefinition[],
    activeSurfaceId: SurfaceId,
    abilities?: Record<import('@/types').CombatSide, RegisteredAbility[]>,
    unitAbilityKeys?: Record<import('@/types').CombatSide, ReadonlySet<string>>,
    factionOwnedKeys?: Record<
      import('@/types').CombatSide,
      ReadonlySet<string>
    >,
    nextCode?: number,
    collapseThreshold?: number,
  ): CombatState {
    const instance = Object.create(CombatState.prototype) as CombatState

    attacker._activeSurfaceId = activeSurfaceId
    defender._activeSurfaceId = activeSurfaceId

    const baseData: CombatStateData = {
      attacker,
      defender,
      combatMode,
      surfaces,
      activeSurfaceId,
      _nextCode: nextCode,
    }

    const emptyKeys = {
      attacker: new Set<string>(),
      defender: new Set<string>(),
    }

    const registered = abilities ?? { attacker: [], defender: [] }

    instance.data = baseData
    instance._collapseThreshold = collapseThreshold
    instance.pendingSteps = []
    // Materialize ability defaults into base config BEFORE building the engine,
    // so its invoke index sees every ability's full params.
    CombatState._ensureAbilityDefaults(baseData, registered)
    instance._params = AbilitiesEngine.fromConfig(
      instance,
      registered,
      unitAbilityKeys ?? emptyKeys,
      factionOwnedKeys ?? emptyKeys,
    )

    // PREPARE abilities mutate baseData in-place. Drain any timing triggers
    // they pushed (e.g. galvanizeUnit's WHEN_GALVANIZE) so they don't leak
    // into the simulation flow as bogus pending steps for the initial meta.
    instance._params.runAbilities('PREPARE')
    if (instance.pendingSteps.length > 0) instance.advance()

    // One-time sort: filter `units[]` to participating-only and order by
    // combat-mode priority rank. Never re-sorted during combat in iteration 1.
    sortUnitsAtSetup(baseData)

    return instance
  }

  public static fromData(
    data: CombatStateData,
    params: AbilitiesEngine,
  ): CombatState {
    const instance = Object.create(CombatState.prototype) as CombatState
    instance.data = data
    instance.pendingSteps = []
    instance._params = params
    const source = params.combatState
    instance._invokes = source._invokes
    instance._collapseThreshold = source._collapseThreshold
    instance._invokesOwned = { attacker: false, defender: false }
    source._invokesOwned = { attacker: false, defender: false }
    instance._allInvokes = source._allInvokes
    instance._allInvokesOwned = false
    source._allInvokesOwned = false
    return instance
  }

  public static fromDataStandalone(
    data: CombatStateData,
    abilities?: Record<import('@/types').CombatSide, RegisteredAbility[]>,
    unitAbilityKeys?: Record<import('@/types').CombatSide, ReadonlySet<string>>,
    factionOwnedKeys?: Record<
      import('@/types').CombatSide,
      ReadonlySet<string>
    >,
  ): CombatState {
    const emptyKeys = {
      attacker: new Set<string>(),
      defender: new Set<string>(),
    }
    const registered = abilities ?? { attacker: [], defender: [] }
    const instance = Object.create(CombatState.prototype) as CombatState
    instance.data = data
    instance.pendingSteps = []
    // Materialize ability defaults into base config BEFORE building the engine,
    // so its invoke index sees every ability's full params.
    CombatState._ensureAbilityDefaults(data, registered)
    instance._params = AbilitiesEngine.wrap(
      instance,
      registered,
      unitAbilityKeys ?? emptyKeys,
      factionOwnedKeys ?? emptyKeys,
    )
    return instance
  }

  /** Materialize static ability defaults into each side's base `abilities`
   *  config for any ability the engine can dispatch (registered config
   *  abilities + abilities attached to units) that has no entry yet. Setup
   *  pipelines already do this for the faction's abilities; this guarantees
   *  the invariant for directly-constructed states (e.g. engine tests, units
   *  carrying ad-hoc abilities) so runtime reads never need registered
   *  defaults. Only fills absent keys — never overwrites existing config. */
  private static _ensureAbilityDefaults(
    data: CombatStateData,
    abilities: Record<import('@/types').CombatSide, RegisteredAbility[]>,
  ): void {
    for (const side of ['attacker', 'defender'] as const) {
      const cfg = data[side].abilities
      const fill = (ability: Ability) => {
        if (cfg[ability.key] === undefined) {
          cfg[ability.key] = { ...extractDefaults(ability) }
        }
      }
      for (const ability of abilities[side]) fill(ability)
      for (const { ability } of AbilitiesEngine.collectUnitAbilities(
        data,
        side,
      ))
        fill(ability)
    }
  }

  assignHits(phase: MetaPhase[]): void {
    this.pushScript([
      ...this.getAssignHitsScript(phase),
      {
        kind: 'method',
        fn: CombatState.prototype._postAssignHits,
        phase,
      },
    ])
  }

  /** Queue a wipe check after a direct unit-removal effect. */
  queueCompletionCheck(phase: MetaPhase[]): void {
    if (this.data.winnerSide !== undefined) return
    const check: PhaseStep = {
      kind: 'method',
      fn: CombatState.prototype._postUnitMutation,
      phase,
    }
    const group = this.pendingSteps.at(-1)
    if (group?.kind === 'group') {
      // Groups execute from the tail. Run the check after all remaining
      // destroy reactions, including any nested cascades they create.
      group.steps.unshift(check)
    } else {
      this.pendingSteps.push(check)
    }
  }

  isFinished(): boolean {
    return this.data.isFinished === true
  }

  getAssignHitsScript(phase: MetaPhase[]): PhaseStep[] {
    return [
      {
        kind: 'timing',
        timing: 'BEFORE_ASSIGN_HITS',
        phase,
      },
      {
        kind: 'method',
        fn: CombatState.prototype._flushPendingCanonicalize,
        phase,
      },
      {
        kind: 'method',
        fn: CombatState.prototype._applyHitAssignmentStep,
        phase,
      },
    ]
  }

  /** Apply any deferred state-canonicalization marks set by
   *  `modifyUnitState`. Runs once per side, just before hits resolve.
   *  Coalesces N marks per phase into at most one canonicalize pass. */
  private _flushPendingCanonicalize(): void {
    const d = this.data
    const a = d.attacker._needsCanonicalize
    if (a) {
      canonicalizeUnitState(d.attacker, a)
    }
    const f = d.defender._needsCanonicalize
    if (f) {
      canonicalizeUnitState(d.defender, f)
    }
  }

  getUnitsHash(): string {
    const d = this.data
    return `${CombatSideState.getUnitsHash(d.attacker)}|${CombatSideState.getUnitsHash(d.defender)}`
  }

  getHash(): string {
    const d = this.data
    return `${CombatSideState.getHash(d.attacker)}|${CombatSideState.getHash(d.defender)}`
  }

  /**
   * Phase state machine driver: pops and executes steps from
   * `pendingSteps` until one of: (a) a step branches, (b) `pendingSteps`
   * drains, (c) `isFinished()` becomes true, or (d) `stopAt` matches the
   * next step. Deterministic runs return `[{ state: this, probability: 1 }]`
   * — literally `this`, no allocation.
   *
   * The caller (combat-engine / test harness) owns phase flow — it must
   * explicitly `loadPhaseScript()` before calling `advance()` on an empty
   * stack, and must resolve transitions (via the flow arrays /
   * `transitionTarget`) between scripts.
   */
  public advance(
    enableLog = false,
    stopAt?: (step: PhaseStep) => boolean,
  ): StateWithProbability[] {
    if (enableLog && !this._logger) {
      this._logger = Logger.create()
    }

    while (this.pendingSteps.length > 0 && !this.isFinished()) {
      const top = this.pendingSteps.at(-1)!
      const step: PhaseStep = top.kind === 'group' ? top.steps.at(-1)! : top
      const groupData: unknown | undefined =
        top.kind === 'group' ? top.data : undefined

      if (stopAt?.(step)) {
        return [{ state: this, probability: 1 }]
      }

      if (step.kind === 'timing') {
        const data = step.data !== undefined ? step.data : groupData
        const branches = this._runTimingStep(step, data)
        if (branches !== undefined) return branches
        // Parked (pass wrote a frame back) — leave the step in place so the
        // next iteration re-peeks it. `stopAt` may match on the resume path.
        if (step.frame) continue
        this._popTopStep()
        continue
      }

      this._popTopStep()
      const result = step.fn.call(this, step.phase, step.payload)
      if (result !== undefined) return result
    }

    return [{ state: this, probability: 1 }]
  }

  /** Pop the current pending step from the top of the stack. If the top is
   *  a group, pop its innermost step; when the group drains, remove it.
   *  No-op when the stack is empty — an ability handler may have cleared it
   *  mid-step (e.g. `syncWinnerSide` cancelling completion after a unit
   *  placement restored a previously-wiped side). */
  private _popTopStep(): void {
    const top = this.pendingSteps[this.pendingSteps.length - 1]
    if (top === undefined) return
    if (top.kind === 'group') {
      top.steps.pop()
      if (top.steps.length === 0) this.pendingSteps.pop()
    } else {
      this.pendingSteps.pop()
    }
  }

  /** Return the `PhaseStep` that `advance()` will dispatch next, or
   *  `undefined` when the stack is empty. Groups are transparent to
   *  callers — the unwrapped inner step is returned. Used by the test
   *  harness and engine consumers that inspect what's about to run. */
  public peekStep(): PhaseStep | undefined {
    const top = this.pendingSteps.at(-1)
    if (!top) return undefined
    if (top.kind === 'group') return top.steps.at(-1)
    return top
  }

  /** `data` of the top-of-stack `PhaseStepGroup`, or `undefined` when
   *  the top entry is a standalone step (or the stack is empty). Exposed
   *  so API layers (e.g. `AbilityContext.getDicePool`) can reach the
   *  current script data without plumbing. */
  get currentGroupData(): unknown {
    const top = this.pendingSteps.at(-1)
    return top?.kind === 'group' ? top.data : undefined
  }

  /** Populate `pendingSteps` with the full script for the given meta.
   *  Called by combat-engine / the test harness when the stack is empty
   *  and combat is still ongoing. Stored in reverse execution order. */
  public loadPhaseScript(meta: MetaPhase, round: number): void {
    const script = this.getPhaseScript(meta, round)
    // Reverse so pop() yields execution order.
    this.pendingSteps = script.slice().reverse()
  }

  /** One script per meta — defines the ordered steps a single round (or
   *  full traversal, for non-combat metas) will run through. Written in
   *  execution order for readability; `loadPhaseScript` reverses for the
   *  LIFO stack. When the script drains, the engine advances to the next
   *  meta. Round-selection for SPACE_COMBAT/GROUND_COMBAT uses the `round`
   *  argument — the caller (combat-engine / test harness) owns it. */
  public getPhaseScript(
    meta: MetaPhase,
    round: number,
    parentMeta?: MetaPhase[],
  ): PendingStep[] {
    const phase: MetaPhase[] = parentMeta ? [...parentMeta, meta] : [meta]
    switch (meta) {
      case 'AFB':
        return [
          { kind: 'timing', timing: 'AFB_STEP', phase },
          {
            kind: 'method',
            fn: CombatState.prototype._postAssignHits,
            phase,
          },
        ]

      case 'BOMBARDMENT':
        return [
          { kind: 'timing', timing: 'BOMBARDMENT_STEP', phase },
          {
            kind: 'method',
            fn: CombatState.prototype._postAssignHits,
            phase,
          },
        ]

      case 'SPACE_CANNON_OFFENSE':
        return [
          { kind: 'timing', timing: 'SPACE_CANNON_OFFENSE_STEP', phase },
          {
            kind: 'method',
            fn: CombatState.prototype._postAssignHits,
            phase,
          },
          { kind: 'timing', timing: 'CLEANUP', phase },
        ]

      case 'SPACE_CANNON_DEFENSE':
        return [
          { kind: 'timing', timing: 'SPACE_CANNON_DEFENSE_STEP', phase },
          {
            kind: 'method',
            fn: CombatState.prototype._postAssignHits,
            phase,
          },
        ]

      case 'SPACE_COMBAT':
      case 'GROUND_COMBAT': {
        return [
          {
            kind: 'timing',
            timing: round === 1 ? 'START_OF_COMBAT' : 'START_OF_COMBAT_ROUND',
            phase,
          },
          ...(meta === 'SPACE_COMBAT' && round === 1
            ? this.getPhaseScript('AFB', round, phase)
            : []),
          { kind: 'timing', timing: 'ANNOUNCE_RETREAT_STEP', phase },
          buildCombatDiceRollGroup({ phase }),
          ...this.getAssignHitsScript(phase),
          { kind: 'timing', timing: 'AFTER_ASSIGN_HITS_STEP', phase },
          {
            kind: 'method',
            fn: CombatState.prototype._postAssignHits,
            phase,
          },
          { kind: 'timing', timing: 'RETREAT_STEP', phase },
          { kind: 'timing', timing: 'END_OF_COMBAT_ROUND', phase },
          { kind: 'timing', timing: 'AFTER_COMBAT_ROUND', phase },
          { kind: 'timing', timing: 'CLEANUP_ROUND', phase },
        ]
      }

      case 'COMMIT_UNITS':
        return [
          { kind: 'timing', timing: 'COMMIT_UNITS', phase },
          {
            kind: 'method',
            fn: CombatState.prototype._commitUnits,
            phase,
          },
        ]
    }
  }

  /** Execute a timing step — a single runAbilities call. Returns branches on
   *  ability-pass interrupt, otherwise `undefined`. `advance()` inspects
   *  `step.frame` afterwards to tell whether the pass parked. */
  private _runTimingStep(
    step: Extract<PhaseStep, { kind: 'timing' }>,
    data: unknown | undefined,
  ): StateWithProbability[] | undefined {
    this._params.setCombatState(this, this._logger)

    try {
      this._params.runAbilities(
        step.timing,
        data as never,
        this._logger?.child(innerMeta(step.phase)),
      )
    } catch (e) {
      if (!(e instanceof AbilityBranchInterrupt)) throw e
      return this._branchesToStates(e.branches)
    }
    return undefined
  }

  // ===========================================================================
  // STEP METHODS (referenced by PhaseStep entries in getPhaseScript)
  // ===========================================================================

  /** Land every eligible attacking unit currently in space on the selected
   *  planet. COMMIT_UNITS abilities run first so Matriarch/Morphwing-style
   *  rules can extend the eligible type list before movement. */
  private _commitUnits(): void {
    const data = this.data
    if (data.combatMode !== 'GROUND') return
    const space = data.surfaces!.find(surface => surface.type === 'SPACE')
    const target = data.surfaces!.find(
      surface =>
        surface.id === data.activeSurfaceId && surface.type === 'PLANET',
    )
    if (!space || !target) return

    const attacker = data.attacker
    const moving: UnitId[] = []
    for (const id of attacker.surfaceUnits[space.id] ?? '') {
      if (isNativeCategory(attacker, attacker.unitType[id], 'GROUND_FORCES'))
        moving.push(id as UnitId)
    }
    CombatSideState.moveUnits(attacker, moving, target.id)
    this.resyncParticipating('attacker')
    this.resyncParticipating('defender')
  }

  /** Swap the two sides' pending hit pools. Queued inside a self-targeting
   *  unit-ability dice-roll group (Proxima self-bomb): the roll produces hits
   *  against the natural opponent so AFTER_UNIT_ABILITY_ROLL abilities (e.g.
   *  X-89) see them through their natural opponent; this then moves them to
   *  the firer so ASSIGN_HITS lands them on the firer's own units. Only one
   *  side has a populated pool at this point (single-firer step), so a plain
   *  reference swap is sufficient. */
  _swapHitPools(): void {
    const d = this.data
    const tmpPool = d.attacker.hitPool
    const tmpShared = d.attacker._hitPoolShared
    d.attacker.hitPool = d.defender.hitPool
    d.attacker._hitPoolShared = d.defender._hitPoolShared
    d.defender.hitPool = tmpPool
    d.defender._hitPoolShared = tmpShared
  }

  /** After ASSIGN_HITS completes: trigger completion if either side is
   *  wiped; otherwise return so the script continues draining. Combat metas
   *  (SPACE_COMBAT / GROUND_COMBAT / AFB) have further steps queued;
   *  non-combat metas drain to empty and the engine picks up the transition. */
  private _postAssignHits(phase: MetaPhase[]): void {
    // Ground pre-combat steps never own completion: an invasion still commits
    // units and resolves defensive fire after a bombardment wipe. Space
    // cannon offense may finish a space battle before its first round.
    // Nested ability steps inherit their combat parent in the phase stack,
    // so Harrow/AFB wipes during a combat round complete immediately.
    const isCombatRound = phase.some(
      meta => meta === 'SPACE_COMBAT' || meta === 'GROUND_COMBAT',
    )
    const d = this.data
    if (!isCombatRound && d.combatMode === 'GROUND') return
    let attackerOut = !CombatSideState.hasParticipatingUnits(d.attacker)
    let defenderOut = !CombatSideState.hasParticipatingUnits(d.defender)

    // Z-Grav Eidolon joins only at START_OF_COMBAT. If an opposing fleet is
    // already present, let the battle reach that timing; the mech remains
    // outside earlier target pools and cannot start a battle by itself.
    if (!isCombatRound && d.combatMode === 'SPACE') {
      if (!attackerOut && defenderOut && this._hasPendingEidolon('defender')) {
        defenderOut = false
      } else if (
        attackerOut &&
        !defenderOut &&
        this._hasPendingEidolon('attacker')
      ) {
        attackerOut = false
      }
    }

    let winner: CombatSide | 'draw' | undefined
    if (attackerOut && defenderOut) winner = 'draw'
    else if (attackerOut) winner = 'defender'
    else if (defenderOut) winner = 'attacker'

    if (winner !== undefined) this._triggerCompletion(phase, winner)
  }

  private _hasPendingEidolon(side: CombatSide): boolean {
    const sideData = this.data[side]
    const params = CombatSideState.getLiveParams(sideData, 'EIDOLON')
    if (!params || params.isEnabled === false) return false
    return (
      CombatSideState.getUnits(sideData, 'MECH', {
        includeVariants: true,
        surfaceId: this.data.activeSurfaceId,
      }).length > 0
    )
  }

  private _postUnitMutation(phase: MetaPhase[]): void {
    this._postAssignHits(phase)
  }

  private _setComplete(): void {
    returnCommittedFighters(this.data)
    this.resyncParticipating('attacker')
    this.resyncParticipating('defender')
    this.data.isFinished = true
  }

  /** Rebuild membership from native categories and explicit instance grants. */
  public resyncParticipating(side: CombatSide): void {
    const data = this.data
    const liveSide = data[side].liveAbilities
    const baseSide = data[side].abilities

    const liveUP = liveSide['UNIT_PRIORITY']
    const baseUP = baseSide['UNIT_PRIORITY']
    const unitPriority =
      liveUP === undefined
        ? baseUP
        : baseUP === undefined
          ? liveUP
          : { ...baseUP, ...liveUP }
    const rawOrderList =
      unitPriority &&
      ((data.combatMode === 'GROUND'
        ? unitPriority.groundUnitPriority
        : unitPriority.spaceUnitPriority) as unknown)
    const orderList = rawOrderList
      ? (unwrapUnitListKeys(rawOrderList) as UnitType[])
      : []

    sortUnitsByPriority(data[side], orderList, id =>
      participatesInCombat(
        data[side],
        id,
        data.combatMode,
        data.activeSurfaceId,
      ),
    )
  }

  /** Replace any in-flight pending steps with the completion sequence and
   *  set `winnerSide` if not already set. The first caller (e.g. an
   *  ability's `transitionTo` pinning a 'draw') wins — later wipe-checks
   *  won't overwrite an explicit decision. After this, combat-state owns
   *  the path to `_setComplete`; the engine and test harness only observe
   *  via `isFinished`. Stored reversed (pop yields END_OF_COMBAT first). */
  public _triggerCompletion(
    phase: MetaPhase[],
    winner: CombatSide | 'draw',
  ): void {
    // Idempotent: once a winner is pinned, the completion sequence is owned
    // by the first caller. Subsequent unit-state changes (Harrow killing the
    // last opponent unit, Alarum placing reinforcements) update winnerSide
    // via `syncWinnerSide` rather than re-pushing the completion script.
    if (this.data.winnerSide !== undefined) return
    this.data.winnerSide = winner
    this.pendingSteps = []
    this.pushScript([
      { kind: 'timing', timing: 'END_OF_COMBAT', phase },
      { kind: 'timing', timing: 'CLEANUP_ROUND', phase },
      { kind: 'timing', timing: 'CLEANUP', phase },
      {
        kind: 'method',
        fn: CombatState.prototype._setComplete,
        phase,
      },
    ])
  }

  /** Re-derive `winnerSide` from current participating-unit state. No-op
   *  unless a winner has already been pinned (initial wipe detection is
   *  owned by `_postAssignHits` → `_triggerCompletion`). Called from
   *  unit-mutation sites so abilities that destroy or place units during
   *  the completion sequence keep the outcome correct:
   *  - A destruction can flip the outcome (e.g. Harrow's bombardment kills
   *    the last opposing infantry → defender→draw, or →attacker).
   *  - A placement that restores a wiped side cancels the completion
   *    entirely: clears `pendingSteps` and `winnerSide` so the engine sees
   *    an empty stack with `isFinished=false` and loads the next round. */
  public syncWinnerSide(): void {
    if (this.data.winnerSide === undefined) return
    const d = this.data
    const attackerOut = !CombatSideState.hasParticipatingUnits(d.attacker)
    const defenderOut = !CombatSideState.hasParticipatingUnits(d.defender)
    if (!attackerOut && !defenderOut) {
      this.pendingSteps = []
      d.winnerSide = undefined
      return
    }
    if (attackerOut && defenderOut) d.winnerSide = 'draw'
    else if (attackerOut) d.winnerSide = 'defender'
    else d.winnerSide = 'attacker'
  }

  public pushScript(entity: PendingStep[]) {
    this.pendingSteps.push(...entity.reverse())
  }
  /** Apply pending hit pools deterministically. When destroyed units need
   *  tracking (logger attached or destroy-timing abilities registered), logs
   *  the destroyed context and pushes a destroy-cascade group onto
   *  `pendingSteps`. Otherwise returns early for speed.
   *
   *  Script-based cascade: the group carries the destroyed-units map as
   *  shared context. When called from an ability (via `assignHits`), the
   *  outer pass is parked by `tryResolveOne` on return and the cascade
   *  drains before the pass resumes. When called as a script step, the
   *  group runs before the rest of the remaining script. */
  private _applyHitAssignmentStep(phase: MetaPhase[]): void {
    const trackDestroyed =
      !!this._logger || this._params.hasDestroyAbilities(this._invokes)

    const meta = innerMeta(phase)
    const data = this.data
    const attackerDestroyed = CombatSideState.assignHits(
      data.attacker,
      trackDestroyed,
    )
    const defenderDestroyed = CombatSideState.assignHits(
      data.defender,
      trackDestroyed,
    )

    this.syncWinnerSide()

    if (!trackDestroyed) return

    const destroyedIds: UnitId[] = []
    for (const ids of Object.values(attackerDestroyed))
      for (const id of ids) destroyedIds.push(id)
    for (const ids of Object.values(defenderDestroyed))
      for (const id of ids) destroyedIds.push(id)

    this._logger?.child(meta).child('ASSIGN_HITS').log({
      attacker: attackerDestroyed,
      defender: defenderDestroyed,
    })

    if (destroyedIds.length > 0) {
      this.pendingSteps.push(buildDestroyGroup(destroyedIds, phase))
    }
  }

  /** Build the dice collection, hand it (along with all queued modifier
   *  declarations) to the math kernel, then dispatch the returned branches
   *  as `StateWithProbability[]`. This single method subsumes what used to
   *  be `_collectDice` + `_rollDice` — the old split existed because
   *  BEFORE_DICE_ROLL needed to mutate the collection; now BEFORE_DICE_ROLL
   *  only queues declarations, so collection-building can wait until roll
   *  time. Engine concerns here: read context, build the collection,
   *  compute targets / use snapshots, log `DICE_POOL`, fork branches.
   *  Effect callbacks (roll triggers, reroll effects) are dispatched per
   *  branch via a freshly-bound `AbilityContext`. */
  _rollDice(phase: MetaPhase[]): StateWithProbability[] | void {
    const ctx = this.currentGroupData
    if (!isDiceRollContext(ctx)) {
      throw new Error('_rollDice called outside a dice-roll group')
    }

    const data = this.data

    // Unit-ability hard-block: if every firing side is blocked from
    // running this hit-source's unit ability, drop the meta's script.
    // For partial blocks (some sides blocked, some not), modifiers
    // declared on a blocked side are dropped further below so config-
    // level decls (e.g. addDiceGroup at BEFORE_UNIT_ABILITY_ROLL) don't
    // sneak past the disable. Unit-attached abilities self-filter via
    // `isCallable` because their unit ability is restricted.
    const blockedSides: CombatSide[] = []
    if (ctx.isUnitAbility) {
      for (const side of ctx.firing) {
        if (
          CombatSideState.isAbilityBlocked(
            data,
            side,
            ctx.hitSource as UnitAbility,
          )
        ) {
          blockedSides.push(side)
        }
      }
      if (blockedSides.length === ctx.firing.length) {
        return
      }
    }

    // Build the per-side collection (custom dice take precedence). Stored
    // on ctx for the DICE_POOL log shape; mutated in place by the kernel.
    const diceCollection = {
      attacker: collectSideDice(
        data,
        'attacker',
        ctx,
        ctx.customDice?.attacker,
      ),
      defender: collectSideDice(
        data,
        'defender',
        ctx,
        ctx.customDice?.defender,
      ),
    }
    // Clear blocked sides' collections so config-level addDiceGroup
    // modifiers (filtered out below) can't slip in via the natural side.
    for (const side of blockedSides) diceCollection[side] = {}
    ctx.diceCollection = diceCollection

    const meta = innerMeta(phase)

    // validTargets uses SETTINGS, which BEFORE_UNIT_ABILITY_ROLL abilities
    // (e.g. WAYLAY) may have just modified — compute here,
    // after they ran. Regular combat rolls leave it empty so hit assignment
    // uses the fast tail-slice path.
    const validTargets = ctx.isUnitAbility
      ? {
          attacker: CombatSideState.getValidTargetsForPhase(
            data.attacker,
            meta,
          ),
          defender: CombatSideState.getValidTargetsForPhase(
            data.defender,
            meta,
          ),
        }
      : { attacker: [], defender: [] }

    let modifiers: readonly import('../dice-math/types').ModifierDecl[] =
      ctx.modifiers ?? []
    // Drop modifiers attached to blocked sides — equivalent to the old
    // skipSides on BEFORE_UNIT_ABILITY_ROLL: config-level decls whose
    // owning side has the hit-source unit ability blocked are silently
    // discarded so they don't synthesize dice for a disabled phase.
    if (blockedSides.length > 0) {
      modifiers = modifiers.filter(m => !blockedSides.includes(m.side))
    }

    // Owner side determines where each ability's `uses` count lives.
    // For REROLL and CONDITIONAL_MODIFIER decls the ability owner can differ
    // from the affected side (e.g. Scramble Frequency on defender rerolling
    // attacker's dice; Heart of Ixth on attacker applying -1 to defender's
    // dice). Those decls carry an explicit `ownerSide`; all other decl types
    // treat `side` as the ability owner.
    //
    // Owner-bearing entries are keyed by `${ownerSide}|${abilityKey}` so two
    // sides owning the same ability key (e.g. both running SCRAMBLE_FREQUENCY)
    // don't collapse onto a single owner. Other decls keep the bare
    // `abilityKey`.
    const abilityOwnerByKey = new Map<string, CombatSide>()
    for (const d of modifiers) {
      if (d.type === 'REROLL' || d.type === 'CONDITIONAL_MODIFIER') {
        const key = `${d.ownerSide}|${d.abilityKey}`
        if (abilityOwnerByKey.has(key)) continue
        abilityOwnerByKey.set(key, d.ownerSide)
      } else {
        if (abilityOwnerByKey.has(d.abilityKey)) continue
        abilityOwnerByKey.set(d.abilityKey, d.side)
      }
    }

    const abilityUses = new Map<string, number>()
    for (const [key, ownerSide] of abilityOwnerByKey) {
      const sepIdx = key.indexOf('|')
      const abilityKey = sepIdx >= 0 ? key.slice(sepIdx + 1) : key
      abilityUses.set(key, this._resolveAbilityUses(ownerSide, abilityKey))
    }

    const skipAfbClampForTarget =
      meta === 'AFB'
        ? {
            attacker: hasAfbAfterRollInvokes(this._invokes, 'attacker'),
            defender: hasAfbAfterRollInvokes(this._invokes, 'defender'),
          }
        : undefined

    const priorityList = {
      attacker: CombatSideState.getPhasePriorityList(
        data.attacker,
        data.combatMode,
        ctx.abilitiesOverride,
      ),
      defender: CombatSideState.getPhasePriorityList(
        data.defender,
        data.combatMode,
        ctx.abilitiesOverride,
      ),
    }

    const { branches, isEmpty } = runDiceMath({
      diceCollection,
      modifiers,
      hitSource: ctx.hitSource,
      firing: ctx.firing,
      isUnitAbility: ctx.isUnitAbility,
      selfTarget: ctx.selfTarget,
      validTargets,
      priorityList,
      sideData: { attacker: data.attacker, defender: data.defender },
      abilityUses,
      meta,
      skipAfbClampForTarget,
      collapseThreshold: this._collapseThreshold,
    })

    if (isEmpty) {
      return
    }

    this._logger
      ?.child(meta)
      .child('DICE_POOL')
      .log({
        attacker: collectionToLogShape(diceCollection.attacker),
        defender: collectionToLogShape(diceCollection.defender),
        hitSource: ctx.hitSource,
      })

    return this._branchesFromMathKernel(
      branches,
      abilityOwnerByKey,
      abilityUses,
      phase,
    )
  }

  /** Resolve an ability's current `uses` value: live overlay → registered
   *  defaults → Infinity. */
  private _resolveAbilityUses(side: CombatSide, key: string): number {
    const merged = CombatSideState.getLiveParams(this.data[side], key)
    if (merged && typeof merged.uses === 'number') return merged.uses
    const ability = this._params.getAbilities(side).find(a => a.key === key)
    const defParams = ability?.params as { uses?: number } | undefined
    return typeof defParams?.uses === 'number' ? defParams.uses : Infinity
  }

  /** Convert `DiceMathBranch[]` from the math kernel into engine-visible
   *  `StateWithProbability[]`. Each branch:
   *   1. Clones state (CoW) from the base.
   *   2. Applies `usesDelta` to `liveAbilities` on owner sides.
   *   3. Appends the math kernel's new pools to each side's `hitPools`
   *      (CoW). At this point `hitPools` is otherwise empty — earlier
   *      `addHits` calls in the round triggered `_assignHits` inline via
   *      the `wasEmpty` path — so a Thundarian-style cancel simply
   *      clears `hitPools` instead of tracking a base index.
   *   4. Removes any `destroyedUnits` from the relevant side.
   *   5. Forks the logger and emits per-branch `DICE_ROLL` / `DICE_HITS`.
   *   6. Dispatches each `PendingEffect` via a freshly-bound `AbilityContext`. */
  private _branchesFromMathKernel(
    branches: DiceMathBranch[],
    abilityOwnerByKey: Map<string, CombatSide>,
    abilityUses: Map<string, number>,
    phase: MetaPhase[],
  ): StateWithProbability[] {
    const metaPhase = innerMeta(phase)
    const ctx = this.currentGroupData as DiceRollContext
    ctx.hitDistribution = {
      attacker: marginalizeBaseHits(branches, 'attacker'),
      defender: marginalizeBaseHits(branches, 'defender'),
    }
    const modifiers = ctx.modifiers ?? []

    const naturalById = new Map<string, RollTriggerDecl>()
    for (const d of modifiers) {
      if (d.type === 'ROLL_TRIGGER') {
        naturalById.set(`${d.side}:${d.slotId}`, d)
      }
    }

    const baseInvokes = this._invokes
    const baseAllInvokes = this._allInvokes
    const baseData = this.data
    const basePendingSteps = this.pendingSteps
    const baseLogger = this._logger

    const results: StateWithProbability[] = []
    for (const branch of branches) {
      if (branch.probability === 0) continue

      // COW-arm invokes (same pattern as the legacy rollDiceOutcomes path).
      this._invokes = baseInvokes
      this._invokesOwned = { attacker: false, defender: false }
      this._allInvokes = baseAllInvokes
      this._allInvokesOwned = false

      const branchData = cloneStateForBranch(baseData)

      // Apply usesDelta — decrement each ability's `uses` on its owner side.
      // Abilities with non-finite (Infinity) uses are skipped: they're
      // unlimited by design, so the per-fire billing factory's delta is
      // a no-op for them. Without this guard, the fallback `currentUses=0`
      // would write `0 - 1 = -1` into liveAbilities and accidentally gate
      // future dispatches.
      for (const [usesKey, delta] of branch.usesDelta) {
        if (delta === 0) continue
        const ownerSide = abilityOwnerByKey.get(usesKey)
        if (ownerSide === undefined) continue
        const snapshotUses = abilityUses.get(usesKey)
        if (snapshotUses === undefined || !Number.isFinite(snapshotUses))
          continue
        // Decode the composite REROLL key back to the bare ability key
        // before writing `liveAbilities` (which is keyed by abilityKey).
        // Non-REROLL keys pass through unchanged.
        const sepIdx = usesKey.indexOf('|')
        const abilityKey = sepIdx >= 0 ? usesKey.slice(sepIdx + 1) : usesKey
        const sideData = branchData[ownerSide]
        sideData.liveAbilities = { ...sideData.liveAbilities }
        const liveEntry =
          (sideData.liveAbilities[abilityKey] as
            | Record<string, unknown>
            | undefined) ?? {}
        const currentUses =
          typeof liveEntry.uses === 'number' ? liveEntry.uses : snapshotUses
        sideData.liveAbilities[abilityKey] = {
          ...liveEntry,
          uses: currentUses - delta,
        }
      }

      // Merge the math kernel's pending pool into the side's existing
      // hitPool. CoW before mutating — sibling branches share the same
      // hitPool object reference until the first mutation on each branch.
      // Thundarian-style cancels clear `hitPool` entirely.
      for (const side of ['attacker', 'defender'] as const) {
        const rawPending = branch.pendingHitPool[side]
        const landingSide = ctx.selfTarget
          ? side === 'attacker'
            ? 'defender'
            : 'attacker'
          : side
        const validTargets = ctx.isUnitAbility
          ? CombatSideState.getValidTargetsForPhase(
              baseData[landingSide],
              metaPhase,
            )
          : undefined
        const targetFilter: UnitTargetFilter | undefined = ctx.isUnitAbility
          ? {
              types: validTargets,
              unitAbility: true,
            }
          : undefined
        const pending = rawPending
        if (pending.base === 0 && pending.custom.length === 0) continue
        const sideData = branchData[side]
        if (sideData.hitPool === undefined) {
          sideData.hitPool = {
            base: pending.base,
            additional: 0,
            custom: pending.custom.map(c => ({ ...c })),
            ...(targetFilter && { targetFilter }),
          }
          sideData._hitPoolShared = false
        } else {
          if (sideData._hitPoolShared) {
            sideData.hitPool = {
              ...sideData.hitPool,
              custom: sideData.hitPool.custom.slice(),
            }
            sideData._hitPoolShared = false
          }
          const own = sideData.hitPool
          if (targetFilter) own.targetFilter = targetFilter
          own.base += pending.base
          for (const c of pending.custom) own.custom.push({ ...c })
        }
      }

      // Remove any destroyed units (kernel currently never produces these;
      // future-proofed for effect-driven destruction).
      if (branch.destroyedUnits.size > 0) {
        const ids = [...branch.destroyedUnits]
        for (const side of ['attacker', 'defender'] as const) {
          CombatSideState.removeUnits(branchData[side], ids)
        }
      }

      const branchLogger = baseLogger?.fork()
      branchLogger?.child(metaPhase).child('DICE_ROLL').log({
        attacker: branch.pendingHitPool.attacker,
        defender: branch.pendingHitPool.defender,
      })

      let hitsToAttacker = branch.pendingHitPool.attacker.base
      for (const c of branch.pendingHitPool.attacker.custom)
        hitsToAttacker += c.base
      let hitsToDefender = branch.pendingHitPool.defender.base
      for (const c of branch.pendingHitPool.defender.custom)
        hitsToDefender += c.base
      branchLogger?.child(metaPhase).child('DICE_HITS').log({
        attacker: hitsToAttacker,
        defender: hitsToDefender,
      })

      // Dispatch pending effects. Each effect needs an AbilityContext bound
      // to the branch state and ability identity. We temporarily point
      // this._params.combatState (=== `this`) at branch data so the ctx
      // reads branch state; restored after each effect.
      if (branch.pendingEffects.length > 0) {
        this.data = branchData
        this._logger = branchLogger
        for (const eff of branch.pendingEffects) {
          this._dispatchPendingEffect(eff, naturalById)
        }
        this.data = baseData
        this._logger = baseLogger
      }

      const branchState = CombatState.fromData(branchData, this._params)
      branchState._logger = branchLogger
      branchState.pendingSteps = clonePendingSteps(basePendingSteps)
      results.push({ state: branchState, probability: branch.probability })
    }

    this.pendingSteps = basePendingSteps
    this._invokes = baseInvokes
    this._invokesOwned = { attacker: true, defender: true }
    this._allInvokes = baseAllInvokes
    this._allInvokesOwned = true
    this.data = baseData
    this._logger = baseLogger

    return results
  }

  /** Look up the declaration and invoke its `effect` callback (if any),
   *  bound to a fresh AbilityContext for the effect's `abilityKey` + `side`. */
  private _dispatchPendingEffect(
    eff: PendingEffect,
    naturalById: Map<string, RollTriggerDecl>,
  ): void {
    const key = `${eff.side}:${eff.slotId}`
    const ability = this._params
      .getAbilities(eff.side)
      .find(a => a.key === eff.abilityKey)
    const decl = naturalById.get(key)
    if (!decl?.effect) return
    const branchCtx = new AbilityContext(eff.side, this._params)
    if (ability) branchCtx.upgradeForCall(ability, this._logger)
    try {
      const payload = eff.payload as { count: number }
      decl.effect(payload.count, branchCtx)
    } finally {
      branchCtx.resetAfterCall()
    }
  }

  /** Convert engine-produced branches (each with its own data/invokes)
   *  into StateWithProbability entries for combat-engine. Each branch
   *  gets a per-branch copy of `pendingSteps`: either the branch's own
   *  continuation (for branches that pushed script state from inside a
   *  rollDice callback) or a clone of the current stack. Parked ability
   *  pass state travels with the cloned steps via `PhaseStep.frame`. */
  private _branchesToStates(branches: AbilityBranch[]): StateWithProbability[] {
    const remainder = this.pendingSteps
    return branches.map(b => {
      const state = CombatState.fromData(b.data, this._params)
      state._logger = b.logger
      state._invokes = b.invokes
      state._invokesOwned = { attacker: false, defender: false }
      state._allInvokes = b.allInvokes
      state._allInvokesOwned = false
      state.pendingSteps = clonePendingSteps(b.pendingSteps ?? remainder)
      return { state, probability: b.probability }
    })
  }

  /** Derive the unit-ability firing config from the given meta. */
  private _getUnitAbilityConfig(meta: MetaPhase): UnitAbilityPhaseConfig {
    switch (meta) {
      case 'SPACE_CANNON_OFFENSE':
        return { firing: ['attacker', 'defender'], hitSource: 'SPACE_CANNON' }
      case 'AFB':
        return { firing: ['attacker', 'defender'], hitSource: 'AFB' }
      case 'BOMBARDMENT':
        return { firing: ['attacker'], hitSource: 'BOMBARDMENT' }
      case 'SPACE_CANNON_DEFENSE':
        return {
          firing: ['defender'],
          hitSource: 'SPACE_CANNON',
          allowedUnitTypes: new Set([...GROUND_FORCES, ...STRUCTURES]),
          sourceSurfaceIds: new Set([this.data.activeSurfaceId!]),
        }
      default:
        throw new Error(`Unexpected meta for unit-ability dice roll: ${meta}`)
    }
  }

  /** Queue a full unit-ability step (DICE_ROLL + ASSIGN_HITS) as nested
   *  script entries. Called from `AbilityContext.resolveStep`: the outer
   *  ability is inside a script-driven pass, so after its `call` returns
   *  the engine parks the pass (pendingSteps grew) and `advance()`
   *  dispatches the pushed step(s) before the outer pass resumes.
   *
   *  The group carries firing-side restriction, optional custom dice,
   *  and an optional `selfTarget` flag (e.g. `target: 'OWN'` self-damage):
   *  hits are produced against the natural opponent, then `_swapHitPools`
   *  (queued inside the dice-roll group, after AFTER_UNIT_ABILITY_ROLL)
   *  moves them to the firer. Everything else (BEFORE/AFTER ASSIGN_HITS,
   *  destroy cascade, completion check) flows through the standard phase
   *  script. */
  public runUnitAbility(config: {
    meta: UnitAbilityMeta
    firing: CombatSide[]
    outerPhase: MetaPhase[]
    customDice?: { attacker: SideDiceCollection; defender: SideDiceCollection }
    selfTarget?: boolean
    /** When true, omit the trailing `_postAssignHits` wipe-check. The
     *  caller will run another step (or steps) whose terminal
     *  `_postAssignHits` covers the combined result. Used by chained
     *  `resolveStep` calls that must resolve atomically (Proxima). */
    deferCompletionCheck?: boolean
    /** Ability params overrides scoped to this resolution. Stamped onto every
     *  timing step the resolution pushes; consumed by the ability loop. */
    abilitiesOverride?: Readonly<AbilitiesOverride>
  }): void {
    const { meta, firing, outerPhase, customDice, selfTarget } = config
    const innermostOuter = outerPhase[outerPhase.length - 1]
    const phase: MetaPhase[] =
      innermostOuter === meta ? [...outerPhase] : [...outerPhase, meta]
    const baseConfig = this._getUnitAbilityConfig(meta)
    const script: PendingStep[] = [
      buildUnitAbilityDiceRollGroup({
        phase,
        firing,
        hitSource: baseConfig.hitSource,
        allowedUnitTypes: baseConfig.allowedUnitTypes,
        sourceSurfaceIds: baseConfig.sourceSurfaceIds,
        customDice,
        selfTarget,
        abilitiesOverride: config.abilitiesOverride,
      }),
      ...this.getAssignHitsScript(phase),
    ]
    if (!config.deferCompletionCheck) {
      script.push({
        kind: 'method',
        fn: CombatState.prototype._postAssignHits,
        phase,
      })
    }
    if (config.abilitiesOverride) {
      stampAbilitiesOverride(script, config.abilitiesOverride)
    }
    this.pushScript(script)
  }

  // ===========================================================================
  // COMBAT PHASE PROCESSING (shared by SPACE_COMBAT and GROUND_COMBAT)
  // ===========================================================================
}

/** Method step that runs AFTER the DESTROY cascade completes — prunes
 *  unit-source candidates for destroyed units from `_allInvokes` and refreshes
 *  emitted invokes so dead units' entries don't accumulate across rounds.
 *  The payload is a flat `UnitId[]` spanning both sides; `removeUnitInvokes`
 *  filters by `source.unitId`, so passing all ids to each side is safe. */
function cleanupDestroyedUnitInvokes(
  this: CombatState,
  _phase: MetaPhase[],
  payload: unknown,
): void {
  const ids = payload as import('@/types').UnitId[]
  if (ids.length === 0) return
  this.params.removeUnitInvokes('attacker', ids)
  this.params.removeUnitInvokes('defender', ids)
}

/** Set `abilitiesOverride` on every timing step in a freshly-built script
 *  (recursing into groups). Method steps run no abilities and are skipped. */
function stampAbilitiesOverride(
  script: PendingStep[],
  override: Readonly<AbilitiesOverride>,
): void {
  for (const entry of script) {
    if (entry.kind === 'group') {
      for (const s of entry.steps) {
        if (s.kind === 'timing') s.abilitiesOverride = override
      }
    } else if (entry.kind === 'timing') {
      entry.abilitiesOverride = override
    }
  }
}

/** Build a PhaseStepGroup that fires the DESTROY → WHEN_DESTROY →
 *  AFTER_DESTROY cascade once, sharing the destroyed-units flat list as the
 *  group's `data`. Steps are stored in reverse execution order so the
 *  group pops DESTROY first. A cleanup method step runs last (stored at
 *  index 0) to prune destroyed units' invoke entries. */
export function buildDestroyGroup(
  destroyedIds: import('@/types').UnitId[],
  phase: MetaPhase[],
): PhaseStepGroup {
  return {
    kind: 'group',
    data: destroyedIds,
    steps: [
      {
        kind: 'method',
        fn: cleanupDestroyedUnitInvokes,
        phase,
        payload: destroyedIds,
      },
      { kind: 'timing', timing: 'AFTER_DESTROY', phase },
      { kind: 'timing', timing: 'WHEN_DESTROY', phase },
      { kind: 'timing', timing: 'DESTROY', phase },
    ],
  }
}

/** Clone a pending-steps stack for branching. Groups get a new wrapper
 *  and a new inner `steps` array, and every timing step is shallow-
 *  copied (with `frame.tracker` deep-cloned) so sibling branches don't
 *  share mutable engine state. Method steps are immutable from the
 *  engine's perspective and can be shared by reference. */
export function clonePendingSteps(steps: PendingStep[]): PendingStep[] {
  return steps.map(s =>
    s.kind === 'group'
      ? {
          ...s,
          data: Array.isArray(s.data) ? [...s.data] : { ...(s.data as object) },
          steps: s.steps.map(cloneStep),
        }
      : cloneStep(s),
  )
}

function cloneStep(step: PhaseStep): PhaseStep {
  if (step.kind !== 'timing') return step
  // Always clone timing steps so sibling branches that share `pendingSteps`
  // can mutate `step.frame` (set by tryResolveOne pre-stamp) independently.
  // Sharing the step object was previously safe because branching only ever
  // produced one in-flight state at a time, but the per-group multiset path
  // creates 4+ sibling branches whose dice-roll group entries reference the
  // same inner steps via `s.steps.map(cloneStep)`. Without deep cloning, a
  // sibling's leaked `step.frame` makes runAbilities treat the next sibling
  // as a resume and skip `hasCallableInvoke`.
  if (!step.frame) return { ...step }

  return {
    ...step,
    frame: {
      ...step.frame,
      tracker: cloneTracker(step.frame.tracker),
      // Per-pass scratch state is mutated in place during the pass; deep-
      // clone so sibling branches don't share it.
      runState: step.frame.runState
        ? structuredClone(step.frame.runState)
        : undefined,
    },
  }
}

/** Build the dice-roll group that resolves a combat or unit-ability dice
 *  roll. Two builders share the LIFO skeleton but differ in which timings
 *  fire (BEFORE_DICE_ROLL vs BEFORE_UNIT_ABILITY_ROLL), the per-side run
 *  options (unit-ability rolls scope by firing side), and which inputs make
 *  sense (combat rolls have no `customDice` / `allowedUnitTypes` /
 *  `selfTarget`, and always fire on both sides at hitSource COMBAT).
 *
 *  Execution order: BEFORE → REROLL → _rollDice → AFTER → AFTER_STEP.
 *  BEFORE/REROLL only queue ModifierDecl entries on `ctx.modifiers`;
 *  `_rollDice` then builds the collection, applies all declarations
 *  (dice-shape mutations, hit-value mods, then the kernel-side REROLL /
 *  ROLL_TRIGGER / CUSTOM_ROLL / CONDITIONAL_MODIFIER /
 *  ADDITIONAL_HIT_POOL passes), and appends the resulting hit pools to
 *  each side's `hitPools`. AFTER is the imperative post-roll timing
 *  where `getPendingHits` / `addHits` work against the just-rolled hits;
 *  AFTER_STEP follows for engine-level wrap-up (e.g. Thundarian's
 *  cancel via `discardCurrentGroupScript`).
 *
 *  `PhaseStepGroup.steps` is consumed LIFO (`top.steps.pop()`), so the
 *  arrays below are stored in reverse execution order. */

/** Build a dice-roll group for SPACE_COMBAT / GROUND_COMBAT. Both sides
 *  always fire at hitSource COMBAT; the BEFORE/REROLL/AFTER timings
 *  run unrestricted (no `skipSides`). */
export function buildCombatDiceRollGroup(args: {
  phase: MetaPhase[]
}): PhaseStepGroup {
  const { phase } = args
  return {
    kind: 'group',
    data: {
      hitSource: 'COMBAT',
      firing: ['attacker', 'defender'],
      isUnitAbility: false,
    },
    steps: [
      { kind: 'timing', timing: 'AFTER_DICE_ROLL_STEP', phase },
      { kind: 'timing', timing: 'AFTER_DICE_ROLL', phase },
      { kind: 'method', fn: CombatState.prototype._rollDice, phase },
      { kind: 'timing', timing: 'REROLL_DICE_ROLL', phase },
      { kind: 'timing', timing: 'BEFORE_DICE_ROLL', phase },
    ],
  }
}

/** Build a dice-roll group for a unit-ability roll (SCO / AFB /
 *  BOMBARDMENT / SCD). BEFORE/AFTER timings scope to the firing sides
 *  via `buildUnitAbilityRunOptions`; `customDice` is forwarded for
 *  `ctx.resolveStep` overrides. When `selfTarget` is set, a `_swapHitPools`
 *  method runs after AFTER_UNIT_ABILITY_ROLL to move the produced hits from
 *  the natural opponent to the firer (Proxima self-bomb). See
 *  `buildCombatDiceRollGroup` for the LIFO ordering invariant and execution
 *  flow. */
export function buildUnitAbilityDiceRollGroup(args: {
  phase: MetaPhase[]
  firing: CombatSide[]
  hitSource: HitSource
  allowedUnitTypes?: ReadonlySet<UnitBaseType>
  sourceSurfaceIds?: ReadonlySet<SurfaceId>
  selfTarget?: boolean
  customDice?: { attacker: SideDiceCollection; defender: SideDiceCollection }
  abilitiesOverride?: Readonly<AbilitiesOverride>
}): PhaseStepGroup {
  const {
    phase,
    firing,
    hitSource,
    allowedUnitTypes,
    sourceSurfaceIds,
    selfTarget,
    customDice,
    abilitiesOverride,
  } = args
  return {
    kind: 'group',
    data: {
      hitSource,
      firing,
      selfTarget,
      customDice,
      allowedUnitTypes,
      sourceSurfaceIds,
      isUnitAbility: true,
      abilitiesOverride,
    },
    steps: [
      // Stored reverse of execution order. The swap (when self-targeting)
      // sits at the top so it runs LAST — after AFTER_UNIT_ABILITY_ROLL has
      // seen the hits in the natural opponent's pool (e.g. X-89 doubling).
      ...(selfTarget
        ? [
            {
              kind: 'method' as const,
              fn: CombatState.prototype._swapHitPools,
              phase,
            },
          ]
        : []),
      {
        kind: 'timing',
        timing: 'AFTER_UNIT_ABILITY_ROLL',
        phase,
      },
      { kind: 'method', fn: CombatState.prototype._rollDice, phase },
      { kind: 'timing', timing: 'REROLL_UNIT_ABILITY_ROLL', phase },
      {
        kind: 'timing',
        timing: 'BEFORE_UNIT_ABILITY_ROLL',
        phase,
      },
    ],
  }
}

/** Collect a side's dice into the kernel-native SideDiceCollection
 *  format. When `customDice` is provided (e.g. by `ctx.resolveStep` with
 *  explicit dice), it's used as-is with an empty unit index (custom
 *  entries don't correspond to real units). */
function collectSideDice(
  state: CombatStateData,
  side: CombatSide,
  ctx: DiceRollContext,
  customCollection: SideDiceCollection | undefined,
): SideDiceCollection {
  if (!ctx.firing.includes(side)) return {}
  // Deep-clone the custom collection so the dice-math kernel (which
  // mutates entries in-place via `applyDiceShapeModifiers`) can't leak
  // changes back into the bomb group's stored `customDice`. The engine's
  // cycle handler re-expands states on cache miss — without this clone,
  // ADD_DICE_COUNT modifiers from a previous expansion stick around and
  // each re-expansion bumps the dice count again (3 → 4 → 5 → ...).
  if (customCollection) return cloneSideDiceCollection(customCollection)
  return CombatSideState.collectDice(
    state,
    side,
    ctx.hitSource,
    ctx.allowedUnitTypes,
    ctx.sourceSurfaceIds,
    (ctx.modifiers ?? []).filter(
      (mod): mod is HitValueModifierDecl =>
        mod.type === 'HIT_VALUE' && mod.side === side && !!mod.unitId,
    ),
  )
}

function cloneSideDiceCollection(
  collection: SideDiceCollection,
): SideDiceCollection {
  const out: SideDiceCollection = {}
  for (const variant of Object.keys(collection) as UnitBaseType[]) {
    const entries = collection[variant]
    if (!entries) continue
    out[variant] = entries.map(e => [...e] as [number, number, number])
  }
  return out
}

/** Reconstruct a `DicePool`-equivalent view from the in-flight
 *  `SideDiceCollection`. Emitted on the DICE_POOL log so test
 *  infrastructure (`t.dicePool()`, `toContainDice`) keeps working. Each
 *  log entry is `[hitValue, totalDpu]` repeated `unitCount` times so the
 *  per-die count stays visible to `.toHaveLength(N)` assertions. */
function collectionToLogShape(collection: SideDiceCollection): DicePool {
  const out: DicePool = {}
  for (const variant of Object.keys(collection) as UnitBaseType[]) {
    const entries = collection[variant]
    if (!entries) continue
    const slot: DiceGroup[] = []
    for (const [count, hitValue, dpu] of entries) {
      for (let i = 0; i < count; i++) slot.push([hitValue, dpu])
    }
    out[variant] = slot
  }
  return out
}

/** Branch clone — CoW for `hitPool` and `unitState`: the new side shares
 *  refs with base and both are flagged as shared. The first side to mutate
 *  either resource clones it via `ensureHitPoolOwned` / `ensureUnitStateOwned`
 *  in combat-side-state.ts. Branches that never write pay nothing.
 *  `units`/`unitType`/`unitStats` stay shared (all mutation paths write
 *  fresh refs). `abilities` (initial config) is shared; `liveAbilities`
 *  is shallow-copied for per-entry COW. */
export function cloneStateForBranch(base: CombatStateData): CombatStateData {
  base.attacker._hitPoolShared = true
  base.attacker._unitStateShared = true
  base.attacker._surfaceUnitsCache ??= []
  base.defender._hitPoolShared = true
  base.defender._unitStateShared = true
  base.defender._surfaceUnitsCache ??= []
  return {
    ...base,
    attacker: { ...base.attacker },
    defender: { ...base.defender },
  }
}
