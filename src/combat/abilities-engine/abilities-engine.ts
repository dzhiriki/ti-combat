import type {
  CombatSide,
  UnitBaseType,
  UnitId,
  UnitIdList,
  UnitType,
} from '@/types'

import {
  CombatSideState,
  getOpponentSide,
} from '../combat-side-state/combat-side-state'
import { CombatState } from '../combat-state/combat-state'
import type {
  CombatStateData,
  MetaPhase,
  SideAbilitiesConfig,
  SideStateData,
} from '../combat-state/types'
import { Logger } from '../logger'
import { resolveUnitStats } from '../utils/resolve-unit-stats'
import { parseVariantId } from '../utils/unit-variant'
import {
  type AbilityBranch,
  AbilityBranchInterrupt,
  AbilityContext,
  withRunningAbility,
} from './api/ability-api'
import { hasStaticInvokes, resolveInvokes } from './resolve-invokes'
import { createRuntimeAbilityList } from './runtime-ability-list'
import type {
  Ability,
  AbilityInvoke,
  AbilityTiming,
  RegisteredAbility,
  RuntimeAbilityList,
} from './types'

export const TIMING_GROUPS: {
  timings: AbilityTiming[]
  paramKey: string
  label: string
}[] = [
  {
    timings: ['START_OF_COMBAT', 'START_OF_COMBAT_ROUND'],
    paramKey: 'startOfCombat',
    label: 'Start of Combat (round)',
  },
  {
    timings: ['BEFORE_ASSIGN_HITS'],
    paramKey: 'beforeAssignHits',
    label: 'Before Assign Hits',
  },
  {
    timings: ['END_OF_COMBAT', 'END_OF_COMBAT_ROUND'],
    paramKey: 'endOfCombat',
    label: 'End of Combat (round)',
  },
]

/** Maps each timing to the ABILITY_ORDER param key that governs its ordering.
 *  Timings not in any group resolve in insertion order. */
const SORT_KEY_BY_TIMING = new Map<AbilityTiming, string>()
for (const group of TIMING_GROUPS) {
  for (const t of group.timings) SORT_KEY_BY_TIMING.set(t, group.paramKey)
}

/** Timings whose entries are collected in a "parent" bucket so a single call
 *  (e.g. `runAbilities('START_OF_COMBAT')` in round 1) fires both the parent
 *  abilities and the child round-scoped ones. */
const MERGED_PARENT_BY_TIMING: Partial<Record<AbilityTiming, AbilityTiming>> = {
  START_OF_COMBAT_ROUND: 'START_OF_COMBAT',
  END_OF_COMBAT_ROUND: 'END_OF_COMBAT',
}

/** Buckets that are pre-sorted (by ABILITY_ORDER) at build-time and after any
 *  dynamic entry change. */
const PRE_SORTED_BUCKETS: AbilityTiming[] = [
  'START_OF_COMBAT',
  'START_OF_COMBAT_ROUND',
  'END_OF_COMBAT',
  'END_OF_COMBAT_ROUND',
  'BEFORE_ASSIGN_HITS',
]

// ── Ability execution engine (module-private helpers) ────────────────────

/** Source of an ability - either from config, a deploy ability, or a unit */
type AbilitySource =
  | { type: 'config' }
  | { type: 'deploy'; unitType: UnitBaseType }
  | { type: 'unit'; unitType: UnitBaseType; unitId: UnitId }

function makeTrackerKey(
  abilityKey: string,
  timing: AbilityTiming,
  source: AbilitySource,
): string {
  switch (source.type) {
    case 'config':
      return `${abilityKey}:${timing}:config`
    case 'deploy':
      return `${abilityKey}:${timing}:${source.unitType}`
    case 'unit':
      return `${abilityKey}:${timing}:${source.unitId}`
  }
}

export interface AbilityCandidate {
  ability: Ability
  source: AbilitySource
  ownerFaction?: string
}

function resolveMergedParams(
  sideData: SideStateData,
  ability: Ability,
): Record<string, unknown> | undefined {
  // Defaults are materialized into `abilities` (base) at setup, so the merged
  // base+live config already carries every default. No registered-default
  // merge needed here.
  const mergedParams = CombatSideState.getLiveParams(sideData, ability.key)
  if (!mergedParams) return undefined
  if ('isEnabled' in mergedParams && !mergedParams.isEnabled) return undefined
  return mergedParams
}

function passesInvoke(
  invoke: AbilityInvoke,
  mergedParams: Record<string, unknown>,
): boolean {
  if (
    !invoke.system &&
    'uses' in mergedParams &&
    typeof mergedParams.uses === 'number' &&
    mergedParams.uses <= 0
  )
    return false
  return true
}

/** True when the ability declares any external invoke. Cached on the ability
 *  (frozen objects are tolerant of an own non-enumerable property; use a
 *  WeakMap to avoid mutating the object). */
const hasExternalInvokeCache = new WeakMap<Ability, boolean>()
function hasExternalInvoke(ability: Ability): boolean {
  const cached = hasExternalInvokeCache.get(ability)
  if (cached !== undefined) return cached
  const value =
    hasStaticInvokes(ability) &&
    ability.invoke.some(inv => inv.external === true)
  hasExternalInvokeCache.set(ability, value)
  return value
}

function buildEntry(
  ability: Ability,
  invoke: AbilityInvoke,
  params: Record<string, unknown>,
  source: AbilitySource,
  ownerFaction: string | undefined,
): TimingInvokeEntry {
  return {
    ability,
    invoke,
    params,
    source,
    ownerFaction,
    trackerKey: makeTrackerKey(ability.key, invoke.timing, source),
  }
}

interface UnitAbilityEntry {
  ability: Ability
  unitType: UnitBaseType
  unitId: UnitId
}

interface TimingInvokeEntry {
  ability: Ability
  invoke: AbilityInvoke
  params: Record<string, unknown>
  source: AbilitySource
  ownerFaction?: string
  trackerKey: string
}

/** Every MetaPhase value. Denormalization target: every no-context entry is
 *  replicated into each of these buckets so a single
 *  `byPhase.get(phase).get(timing)` returns everything applicable. */
const ALL_META_PHASES: readonly MetaPhase[] = [
  'SPACE_COMBAT',
  'COMMIT_UNITS',
  'GROUND_COMBAT',
  'BOMBARDMENT',
  'AFB',
  'SPACE_CANNON_OFFENSE',
  'SPACE_CANNON_DEFENSE',
]

/** Per-side invokes index, denormalized. Each `byPhase[phase]` bucket
 *  contains every entry applicable in that phase — both `invoke.context`
 *  entries restricted to that phase AND no-context entries (which apply
 *  everywhere). A single-phase read does one map-of-maps lookup and returns
 *  the array directly. */
type SideInvokes = Map<MetaPhase, Map<AbilityTiming, TimingInvokeEntry[]>>

function createSideInvokes(): SideInvokes {
  const byPhase: SideInvokes = new Map()
  for (const p of ALL_META_PHASES) byPhase.set(p, new Map())
  return byPhase
}

function pushIntoBucket(
  bucket: Map<AbilityTiming, TimingInvokeEntry[]>,
  timing: AbilityTiming,
  entry: TimingInvokeEntry,
): void {
  const list = bucket.get(timing)
  if (list) list.push(entry)
  else bucket.set(timing, [entry])

  const parent = MERGED_PARENT_BY_TIMING[timing]
  if (parent !== undefined) {
    const parentList = bucket.get(parent)
    if (parentList) parentList.push(entry)
    else bucket.set(parent, [entry])
  }
}

function filterBucketByKey(
  bucket: Map<AbilityTiming, TimingInvokeEntry[]>,
  abilityKey: string,
): void {
  for (const [timing, entries] of bucket) {
    const filtered = entries.filter(e => e.ability.key !== abilityKey)
    if (filtered.length !== entries.length) {
      if (filtered.length === 0) bucket.delete(timing)
      else bucket.set(timing, filtered)
    }
  }
}

/** Place `entry` in the applicable buckets. No-context entries are
 *  replicated into every phase bucket so a read for any single phase returns
 *  them in one lookup. Phase-restricted entries go only into the listed
 *  phase buckets. Round-scoped timings are duplicated to their parent timing
 *  (see `MERGED_PARENT_BY_TIMING`) inside each bucket. */
function pushInvokeEntry(side: SideInvokes, entry: TimingInvokeEntry): void {
  const timing = entry.invoke.timing
  const ctx = entry.invoke.context
  if (!ctx) {
    for (const bucket of side.values()) pushIntoBucket(bucket, timing, entry)
    return
  }
  if (typeof ctx === 'string') {
    pushIntoBucket(side.get(ctx)!, timing, entry)
    return
  }
  for (const phase of ctx) {
    pushIntoBucket(side.get(phase)!, timing, entry)
  }
}

/** Sort a bucket in place by the ABILITY_ORDER array for its sort group.
 *  Entries not listed in the order keep their insertion order relative to each
 *  other, after any listed entries. */
function sortBucket(
  entries: TimingInvokeEntry[],
  sideConfig: Record<string, Record<string, unknown>>,
  timing: AbilityTiming,
): void {
  const paramKey = SORT_KEY_BY_TIMING.get(timing)
  if (!paramKey) return
  const orderConfig = sideConfig['ABILITY_ORDER']
  if (!orderConfig) return
  const order = orderConfig[paramKey] as [string][] | undefined
  if (!order || order.length === 0) return

  const orderIndex = new Map(order.map(([key], i) => [key, i]))
  let nextSlot = order.length
  const sortKey = new Map<TimingInvokeEntry, number>()
  for (const entry of entries) {
    const oi = orderIndex.get(entry.ability.key)
    sortKey.set(entry, oi !== undefined ? oi : nextSlot++)
  }
  entries.sort((a, b) => sortKey.get(a)! - sortKey.get(b)!)
}

/** Re-sort every pre-sorted bucket for a side across all phase buckets. */
function sortPreSortedBuckets(
  side: SideInvokes,
  sideConfig: Record<string, Record<string, unknown>>,
): void {
  for (const bucket of side.values()) {
    for (const timing of PRE_SORTED_BUCKETS) {
      const entries = bucket.get(timing)
      if (entries && entries.length > 1) sortBucket(entries, sideConfig, timing)
    }
  }
}

/** Copy-on-write: shallow-copy the liveAbilities path so in-place mutations
 *  don't leak into other branches that share the same liveAbilities object.
 *  Returns the (now owned) live-ability entry for `abilityKey`. */
function cowLiveAbilityEntry(
  draft: CombatStateData,
  side: CombatSide,
  abilityKey: string,
): Record<string, unknown> {
  const sideData = draft[side]
  sideData.liveAbilities = { ...sideData.liveAbilities }
  const entry = sideData.liveAbilities[abilityKey]
  const clone = entry ? { ...entry } : {}
  sideData.liveAbilities[abilityKey] = clone
  return clone
}

/** Decrement `uses` in ability config after a successful invocation.
 *  Writes the new value into `liveAbilities`, leaving `abilities` untouched.
 *  Reads the *current* uses (live overlay → base → pre-call params) so that
 *  abilities that update their own uses inside the call aren't clobbered. */
function decrementUses(
  draft: CombatStateData,
  side: CombatSide,
  abilityKey: string,
  engine?: AbilitiesEngine,
): void {
  // Defaults are materialized into `abilities` (base) at setup, so the current
  // `uses` value always lives in live → base. No registered-default fallback.
  const live = draft[side].liveAbilities[abilityKey]
  const base = draft[side].abilities[abilityKey]
  const currentUses =
    live && typeof live.uses === 'number'
      ? live.uses
      : base && typeof base.uses === 'number'
        ? base.uses
        : undefined
  if (currentUses === undefined || !isFinite(currentUses)) return
  const entry = cowLiveAbilityEntry(draft, side, abilityKey)
  entry.uses = currentUses - 1
  if (engine) {
    engine.addAbilityInvokes(side, abilityKey, draft)
  }
}

// ── Tracker types ────────────────────────────────────────────────────────

/** Invocation tracker for a single side's abilities.
 *  Key format: `${ability.key}:${invoke.timing}:${source}` where source is
 *  `'config'` for config abilities, the base `unitType` for deploy abilities,
 *  and `String(unitId)` for unit abilities. */
export type SideInvocationTracker = Set<string>

export type InvocationTracker = Record<CombatSide, SideInvocationTracker>

/** Snapshot of an in-flight `runAbilities` pass. Stored on the timing
 *  `PhaseStep.frame` slot so the pass resumes from the exact step that
 *  parked it; cloning `pendingSteps` for a branch carries the frame
 *  through automatically. Static fields (timing, options, phase, owner
 *  identity) live on the step itself; this frame holds only the
 *  alternation state. */
export interface AbilityPassFrame {
  tracker: InvocationTracker
  currentSide: CombatSide
  consecutiveSkips: number
  /** Ephemeral per-pass scratch state, keyed by side then ability key.
   *  Written via `SideApi.updateRunState`, read via `getRunState`. Lives
   *  only for the duration of one `runAbilities` pass (carried across
   *  park/resume on the dispatching step's frame, deep-cloned per branch
   *  by `clonePendingSteps`), then discarded — never hashed into state
   *  identity. Use for data scoped to a single timing run, e.g. which
   *  structures a Linkship pass has already consumed. */
  runState?: Record<CombatSide, SideAbilitiesConfig>
}

export interface RunAbilitiesOptions {
  /** Remap `ctx.api.opponent` per invoker side. Used by unit-ability phases
   *  (BOMBARDMENT, AFB, SPACE_CANNON_*) so abilities see "opponent" as their
   *  counterparty in the action — target when firing, firing when targeted —
   *  regardless of actual attacker/defender labels. Lets abilities like X-89
   *  and Bunker resolve their counterparty naturally. */
  opponentSideByInvokerSide?: { attacker: CombatSide; defender: CombatSide }
}

// ── Main class ───────────────────────────────────────────────────────────

export interface InvokeCollections {
  attacker: SideInvokes
  defender: SideInvokes
  _hasDestroyAbilities?: boolean
}

function cloneTimingMap(
  m: Map<AbilityTiming, TimingInvokeEntry[]>,
): Map<AbilityTiming, TimingInvokeEntry[]> {
  const out = new Map<AbilityTiming, TimingInvokeEntry[]>()
  for (const [timing, entries] of m) out.set(timing, [...entries])
  return out
}

export function cloneSideInvokes(side: SideInvokes): SideInvokes {
  const out: SideInvokes = new Map()
  for (const [phase, bucket] of side) out.set(phase, cloneTimingMap(bucket))
  return out
}

/** Clone an invocation tracker for independent continuation in a branch. */
export function cloneTracker(tracker: InvocationTracker): InvocationTracker {
  return {
    attacker: new Set(tracker.attacker),
    defender: new Set(tracker.defender),
  }
}

/** Snapshot of the pieces we need to restore after swapping to a branch. */
interface BranchStateSnapshot {
  data: CombatStateData
  invokes: InvokeCollections
  invokesOwned: { attacker: boolean; defender: boolean }
  allInvokes: Record<CombatSide, AbilityCandidate[]>
  allInvokesOwned: boolean
  logger?: Logger
}

/**
 * Simulation-only ability engine.
 *
 * Has a direct bidirectional link with CombatState — reads and writes
 * ability config through CombatState.data[side].abilities. Abilities
 * mutate the shared Mutative draft on CombatState.data directly.
 */
const SPACE_PHASE: MetaPhase[] = ['SPACE_COMBAT']
const GROUND_PHASE: MetaPhase[] = ['GROUND_COMBAT']

/** Lazy index — `_allInvokes[side]` array ref → Set of UnitIds appearing
 *  as `source.unitId` in that array. Module-level WeakMap so `Object.create`-
 *  initialized engine instances share the cache (cache keys are array
 *  refs and unique-per-state). Used by `removeUnitInvokes` to short-circuit
 *  fighter-only destroys (no per-unit ability candidates → nothing to
 *  remove). */
const unitsWithCandidatesCache = new WeakMap<AbilityCandidate[], Set<UnitId>>()

export class AbilitiesEngine {
  private _combatState!: CombatState
  private _abilities!: Record<CombatSide, RegisteredAbility[]>
  private _unitAbilityKeys!: Record<CombatSide, ReadonlySet<string>>
  private _attackerCtx!: AbilityContext
  private _defenderCtx!: AbilityContext
  private _runtimeLists?: Partial<Record<CombatSide, RuntimeAbilityList>>
  private _abilityByKey?: Partial<
    Record<CombatSide, ReadonlyMap<string, RegisteredAbility>>
  >

  /** Run-state of the `runAbilities` pass currently executing, or undefined
   *  when no pass is active. Set at the top of `runAbilities` (seeded from
   *  the resume frame), restored on return. `SideApi.updateRunState` /
   *  `getRunState` read/write through this. See `AbilityPassFrame.runState`. */
  _currentRunState?: Record<CombatSide, SideAbilitiesConfig>

  _logger?: Logger

  private _getUnitsWithCandidates(side: CombatSide): Set<UnitId> {
    const all = this._combatState._allInvokes[side]
    let cached = unitsWithCandidatesCache.get(all)
    if (cached === undefined) {
      cached = new Set<UnitId>()
      for (let i = 0; i < all.length; i++) {
        const src = all[i].source
        if (src.type === 'unit') cached.add(src.unitId)
      }
      unitsWithCandidatesCache.set(all, cached)
    }
    return cached
  }

  private get state(): CombatStateData {
    return this._combatState.data
  }

  get combatState(): CombatState {
    return this._combatState
  }

  setCombatState(cs: CombatState, logger?: Logger): void {
    this._combatState = cs
    this._logger = logger
  }

  /** Capture current engine/combatState state so it can be restored after
   *  processing a branch. */
  _saveBranchState(): BranchStateSnapshot {
    return {
      data: this._combatState.data,
      invokes: this._combatState._invokes,
      invokesOwned: { ...this._combatState._invokesOwned },
      allInvokes: this._combatState._allInvokes,
      allInvokesOwned: this._combatState._allInvokesOwned,
      logger: this._logger,
    }
  }

  /** Swap engine/combatState to a given branch's data/invokes/logger.
   *  Sibling branches from the same rollDice call may share the same `invokes`
   *  reference (if the rollDice callback didn't trigger a COW). We mark the
   *  invokes as unowned so the next mutation triggers `ensureOwnInvokes` and
   *  isolates this branch's mutations from its siblings. */
  _setBranchState(branch: AbilityBranch): void {
    this._combatState.data = branch.data
    this._combatState._invokes = branch.invokes
    this._combatState._invokesOwned = { attacker: false, defender: false }
    this._combatState._allInvokes = branch.allInvokes
    this._combatState._allInvokesOwned = false
    this._logger = branch.logger
  }

  /** Restore state captured by _saveBranchState. */
  _restoreBranchState(snap: BranchStateSnapshot): void {
    this._combatState.data = snap.data
    this._combatState._invokes = snap.invokes
    this._combatState._invokesOwned = snap.invokesOwned
    this._combatState._allInvokes = snap.allInvokes
    this._combatState._allInvokesOwned = snap.allInvokesOwned
    this._logger = snap.logger
  }

  // ── Read accessors ──────────────────────────────────────────────────

  get attackerFaction(): string {
    return this.state.attacker.faction
  }

  get defenderFaction(): string {
    return this.state.defender.faction
  }

  getAbilities(side: CombatSide): RegisteredAbility[] {
    return this._abilities[side]
  }

  get unitAbilityKeys(): Record<CombatSide, ReadonlySet<string>> {
    return this._unitAbilityKeys
  }

  context(side: CombatSide): AbilityContext {
    return side === 'attacker' ? this._attackerCtx : this._defenderCtx
  }

  /** Enumerate enabled abilities (registered for this side) that have at
   *  least one invoke matching `timing`. Iterates the side's deduped
   *  ability list rather than `_invokes`, so unit abilities like
   *  SUSTAIN_DAMAGE surface even when no unit currently carries them —
   *  e.g. for the Resolve Order UI, which must still list them in case a
   *  mid-combat effect places such a unit. */
  getAbilityKeysForTiming(
    side: CombatSide,
    timing: AbilityTiming | AbilityTiming[],
  ): { key: string; name: string }[] {
    const timingSet = new Set(Array.isArray(timing) ? timing : [timing])
    const combatMode = this._combatState.data.combatMode
    const sideData = this._combatState.data[side]
    const results: { key: string; name: string }[] = []
    for (const ability of this._abilities[side]) {
      if (ability.context && ability.context !== combatMode) continue
      const merged = resolveMergedParams(sideData, ability)
      if (!merged) continue
      if (
        'uses' in merged &&
        typeof merged.uses === 'number' &&
        isFinite(merged.uses) &&
        merged.uses <= 0
      )
        continue
      if (
        !resolveInvokes(ability, merged, this.context(side)).some(inv =>
          timingSet.has(inv.timing),
        )
      )
        continue
      results.push({ key: ability.key, name: ability.name })
    }
    return results
  }

  /** Fast check: any DESTROY/WHEN_DESTROY/AFTER_DESTROY invokes registered? */
  hasDestroyAbilities(invokes?: InvokeCollections): boolean {
    invokes ??= this._combatState._invokes
    if (invokes._hasDestroyAbilities !== undefined)
      return invokes._hasDestroyAbilities
    const has = (m: Map<AbilityTiming, TimingInvokeEntry[]>): boolean =>
      !!(
        m.get('DESTROY')?.length ||
        m.get('WHEN_DESTROY')?.length ||
        m.get('AFTER_DESTROY')?.length
      )
    let result = false
    outer: for (const side of ['attacker', 'defender'] as const) {
      for (const bucket of invokes[side].values()) {
        if (has(bucket)) {
          result = true
          break outer
        }
      }
    }
    invokes._hasDestroyAbilities = result
    return result
  }

  // ── Factories ──────────────────────────────────────────────────────

  /**
   * Create from pre-reconciled config data (simulation initialization path).
   *
   * `abilities` lists each ability once per side, in registration order —
   * the data layer guarantees it (see `getAvailableAbilities`).
   *
   * Expects the caller to have already run reconciliation
   * (via prepareSimulationConfig). This factory just loads abilities
   * and builds invokes from the config as-is.
   */
  static fromConfig(
    combatState: CombatState,
    abilities: Record<CombatSide, RegisteredAbility[]>,
    unitAbilityKeys: Record<CombatSide, ReadonlySet<string>>,
    factionOwnedKeys: Record<CombatSide, ReadonlySet<string>>,
  ): AbilitiesEngine {
    const instance = Object.create(AbilitiesEngine.prototype) as AbilitiesEngine
    instance._combatState = combatState
    instance._abilities = abilities
    instance._unitAbilityKeys = unitAbilityKeys
    instance._attackerCtx = new AbilityContext('attacker', instance)
    instance._defenderCtx = new AbilityContext('defender', instance)
    combatState._allInvokes = {
      attacker: AbilitiesEngine.collectAbilityCandidates(
        combatState.data,
        'attacker',
        abilities.attacker,
        unitAbilityKeys.attacker,
        factionOwnedKeys.attacker,
      ),
      defender: AbilitiesEngine.collectAbilityCandidates(
        combatState.data,
        'defender',
        abilities.defender,
        unitAbilityKeys.defender,
        factionOwnedKeys.defender,
      ),
    }
    combatState._allInvokesOwned = true
    instance.buildInvokes()
    return instance
  }

  /**
   * Lightweight factory — creates instance without cloning or reconciliation.
   * Used for read-only contexts where we only need ability lookups and
   * default merging (CombatState.fromData fallback, etc.).
   */
  static wrap(
    combatState: CombatState,
    abilities: Record<CombatSide, RegisteredAbility[]>,
    unitAbilityKeys: Record<CombatSide, ReadonlySet<string>>,
    factionOwnedKeys: Record<CombatSide, ReadonlySet<string>>,
  ): AbilitiesEngine {
    const instance = Object.create(AbilitiesEngine.prototype) as AbilitiesEngine
    instance._combatState = combatState
    instance._abilities = abilities
    instance._unitAbilityKeys = unitAbilityKeys
    instance._attackerCtx = new AbilityContext('attacker', instance)
    instance._defenderCtx = new AbilityContext('defender', instance)
    combatState._allInvokes = {
      attacker: AbilitiesEngine.collectAbilityCandidates(
        combatState.data,
        'attacker',
        abilities.attacker,
        unitAbilityKeys.attacker,
        factionOwnedKeys.attacker,
      ),
      defender: AbilitiesEngine.collectAbilityCandidates(
        combatState.data,
        'defender',
        abilities.defender,
        unitAbilityKeys.defender,
        factionOwnedKeys.defender,
      ),
    }
    combatState._allInvokesOwned = true
    instance.buildInvokes()
    return instance
  }

  runtimeAbilityList(side: CombatSide): RuntimeAbilityList {
    const lists = (this._runtimeLists ??= {})
    return (lists[side] ??= createRuntimeAbilityList(this._abilities[side]))
  }

  /** Registered ability for `key` on `side`, or undefined. O(1) after the
   *  first call per side; `_abilities[side]` never changes after creation. */
  abilityForKey(side: CombatSide, key: string): RegisteredAbility | undefined {
    const maps = (this._abilityByKey ??= {})
    const map = (maps[side] ??= new Map(
      this._abilities[side].map(a => [a.key, a]),
    ))
    return map.get(key)
  }

  /** Collect unit abilities from units on the field */
  static collectUnitAbilities(
    state: CombatStateData,
    side: CombatSide,
  ): UnitAbilityEntry[] {
    const sideState = state[side]

    // Quick check: skip if no unit stats have ABILITIES at all
    let hasAnyAbilities = false
    for (const key in sideState.unitStats) {
      if (resolveUnitStats(sideState.unitStats, key as UnitType)?.ABILITIES) {
        hasAnyAbilities = true
        break
      }
    }
    if (!hasAnyAbilities) return []

    const entries: UnitAbilityEntry[] = []

    const collect = (pool: UnitIdList) => {
      for (const id of pool) {
        const key = sideState.unitType[id]
        if (!key) continue
        const stats = resolveUnitStats(sideState.unitStats, key)
        if (!stats?.ABILITIES) continue
        const { type: unitType } = parseVariantId(key)

        for (const ability of stats.ABILITIES) {
          entries.push({
            ability,
            unitType: unitType as UnitBaseType,
            unitId: id as UnitId,
          })
        }
      }
    }
    collect(sideState.participatingUnits)
    collect(sideState.nonParticipatingUnits)
    return entries
  }

  /** Collect deploy abilities from unit stats (not requiring units on field) */
  static collectDeployAbilities(
    state: CombatStateData,
    side: CombatSide,
  ): { ability: Ability; unitType: UnitBaseType }[] {
    const sideState = state[side]
    const seen = new Set<UnitBaseType>()
    const entries: { ability: Ability; unitType: UnitBaseType }[] = []

    for (const key of Object.keys(sideState.unitStats)) {
      const stats = resolveUnitStats(sideState.unitStats, key as UnitType)
      const deploy = stats?.UNIT_ABILITIES?.DEPLOY
      if (!deploy) continue
      const { type: baseType } = parseVariantId(key as UnitType)
      if (seen.has(baseType as UnitBaseType)) continue
      seen.add(baseType as UnitBaseType)
      entries.push({ ability: deploy, unitType: baseType as UnitBaseType })
    }
    return entries
  }

  /** Collect all ability candidates for a side. Produces stable entries
   *  (ability + source + ownerFaction) used to build timing-bucket invokes.
   *  Candidates are not filtered by `isEnabled`/`uses` — that happens when
   *  emitting entries via `buildInvokes` / `addAbilityInvokes`. */
  static collectAbilityCandidates(
    state: CombatStateData,
    side: CombatSide,
    abilities: readonly RegisteredAbility[],
    unitAbilityKeys: ReadonlySet<string>,
    factionOwnedKeys: ReadonlySet<string>,
  ): AbilityCandidate[] {
    const candidates: AbilityCandidate[] = []
    const ownerFactionIfOwned = (ability: Ability): string | undefined =>
      factionOwnedKeys.has(ability.key) ? state[side].faction : undefined

    // 1. Config abilities (not unit abilities)
    for (const ability of abilities) {
      if (unitAbilityKeys.has(ability.key)) continue
      if (ability.context && ability.context !== state.combatMode) continue
      candidates.push({
        ability,
        source: { type: 'config' },
        ownerFaction: ownerFactionIfOwned(ability),
      })
    }

    // 2. Unit abilities from units on field
    const unitEntries = AbilitiesEngine.collectUnitAbilities(state, side)
    const collectedUnitKeys = new Set<string>()
    for (const { ability, unitType, unitId } of unitEntries) {
      collectedUnitKeys.add(ability.key)
      if (ability.context && ability.context !== state.combatMode) continue
      candidates.push({
        ability,
        source: { type: 'unit', unitType, unitId },
        ownerFaction: state[side].faction,
      })
    }

    // 3. Externalizable unit abilities whose unit is not on the field —
    //    registered as config-sourced so the ability still runs (e.g. a
    //    flagship ability active when the flagship is deployed elsewhere).
    //    Ability `isCallable` must tolerate `ctx.unitSource === undefined`.
    for (const ability of abilities) {
      if (!unitAbilityKeys.has(ability.key)) continue
      if (!hasExternalInvoke(ability)) continue
      if (collectedUnitKeys.has(ability.key)) continue
      if (ability.context && ability.context !== state.combatMode) continue
      candidates.push({
        ability,
        source: { type: 'config' },
        ownerFaction: state[side].faction,
      })
    }

    // 4. Deploy abilities
    const deployEntries = AbilitiesEngine.collectDeployAbilities(state, side)
    for (const { ability, unitType } of deployEntries) {
      if (ability.context && ability.context !== state.combatMode) continue
      candidates.push({
        ability,
        source: { type: 'deploy', unitType },
        ownerFaction: state[side].faction,
      })
    }

    return candidates
  }

  // ── Ability execution engine ──────────────────────────────────────

  runAbilities<T extends AbilityTiming>(
    timing: T,
    context?: TimingContextMap[T],
    logger?: Logger,
  ): void {
    // The dispatching timing step (and its phase stack) comes from the
    // combat state. When omitted (e.g. PREPARE pass, test-driven call),
    // `currentStep` is undefined — context-filtered invokes are skipped
    // and there's no frame to park into.
    const step = this._combatState.currentStep

    // Resume from the step's frame if one was parked. Consume it here —
    // if the pass parks again or branches, a new frame will be written.
    const resume = step?.frame
    if (step && resume) step.frame = undefined

    const phase =
      step?.phase && step.phase.length > 0 ? step.phase : this.defaultPhase()

    if (!resume && !this.hasCallableInvoke(timing, phase)) return

    const activeLogger = logger ?? this._logger

    const tracker: InvocationTracker = resume?.tracker ?? {
      attacker: new Set(),
      defender: new Set(),
    }

    // Per-pass scratch state — resumed from the frame, otherwise fresh.
    // Exposed via `_currentRunState` for the duration of the pass so
    // `SideApi.updateRunState`/`getRunState` reach it, then restored.
    const runState = resume?.runState ?? { attacker: {}, defender: {} }
    const prevRunState = this._currentRunState
    this._currentRunState = runState

    try {
      this._runAbilityLoop(
        timing,
        tracker,
        resume?.currentSide ?? 'attacker',
        resume?.consecutiveSkips ?? 0,
        context,
        activeLogger,
      )
    } finally {
      this._currentRunState = prevRunState
    }
  }

  /**
   * Core alternation loop for runAbilities. Alternates sides resolving one
   * ability at a time until both sides skip consecutively. tryResolveOne
   * pre-stamps the dispatching step's `.frame` before calling the ability
   * so any branches produced inside the call (via `ctx.rollDice`) inherit
   * the correct resume frame through `clonePendingSteps`. On a normal
   * 'ran' tryResolveOne clears the frame; on 'parked' it leaves the frame
   * set, and on branch (AbilityBranchInterrupt) the outer step is
   * abandoned along with its state. The loop itself only has to re-throw
   * the interrupt.
   */
  private _runAbilityLoop<T extends AbilityTiming>(
    timing: T,
    tracker: InvocationTracker,
    startSide: CombatSide,
    consecutiveSkips: number,
    context: TimingContextMap[T] | undefined,
    logger?: Logger,
  ): void {
    let currentSide: CombatSide = startSide

    while (consecutiveSkips < 2) {
      const result = this.tryResolveOne(
        timing,
        currentSide,
        context,
        tracker,
        logger,
      )

      if (result === 'parked') return

      if (result === 'ran-stay') {
        consecutiveSkips = 0
        // External invoke fired by a non-owner side — don't consume the
        // alternation slot; dispatch the next invoke on the same side.
        continue
      }

      if (result === 'ran') {
        consecutiveSkips = 0
      } else {
        consecutiveSkips += 1
      }

      currentSide = getOpponentSide(currentSide)
    }
  }

  // ── Private execution engine methods ──────────────────────────────

  /**
   * Try to resolve the next applicable ability for `side`.
   * @returns `'ran'` if an ability was called, `'skipped'` if none applied,
   *   `'parked'` if the call pushed a new timing step via `ctx.trigger`
   *   (caller yields control to the script; the dispatching step's
   *   `.frame` has been populated).
   * @throws AbilityBranchInterrupt if the call produced branches. Before
   *   calling, `step.frame` is pre-stamped with the post-invoke tracker
   *   and resume side so per-branch clones of `pendingSteps` inherit the
   *   correct frame via `clonePendingSteps`.
   */
  private tryResolveOne<T extends AbilityTiming>(
    timing: T,
    side: CombatSide,
    context: TimingContextMap[T] | undefined,
    tracker: InvocationTracker,
    logger?: Logger,
  ): 'ran' | 'ran-stay' | 'skipped' | 'parked' {
    const state = this._combatState.data
    const step = this._combatState.currentStep
    const phase =
      step?.phase && step.phase.length > 0 ? step.phase : this.defaultPhase()
    const invokes = this.getInvokesForTiming(timing, side, phase)

    const sideTracker = tracker[side]

    for (const entry of invokes) {
      const { ability, invoke, params, source, ownerFaction } = entry

      if (sideTracker.has(entry.trackerKey)) continue

      if (source.type === 'deploy') {
        if (
          CombatSideState.isRestricted(
            state,
            side,
            'lost',
            'DEPLOY',
            source.unitType,
          )
        )
          continue
        if (
          CombatSideState.isRestricted(
            state,
            side,
            'cannotBeUsed',
            'DEPLOY',
            source.unitType,
          )
        )
          continue
      }

      const liveOverlay = state[side].liveAbilities[ability.key]
      const override = (
        step?.abilitiesOverride as
          | Record<string, boolean | Record<string, unknown>>
          | undefined
      )?.[ability.key]
      let freshParams = liveOverlay ? { ...params, ...liveOverlay } : params
      if (override !== undefined) {
        freshParams = {
          ...freshParams,
          ...(typeof override === 'boolean'
            ? { isEnabled: override }
            : override),
        }
      }

      // oxlint-disable-next-line typescript/no-explicit-any
      const inv = invoke as any

      const unitSource = source.type === 'unit' ? source.unitId : undefined

      if ('isEnabled' in freshParams && !freshParams.isEnabled) continue
      if (
        !invoke.system &&
        'uses' in freshParams &&
        typeof freshParams.uses === 'number' &&
        freshParams.uses <= 0
      )
        continue

      const ctx = this.context(side)
      ctx.unitSource = unitSource
      ctx.ownerFaction = ownerFaction
      ctx.ability = ability

      let canCall: boolean
      if (inv.isCallable) {
        canCall = inv.isCallable(freshParams, ctx, context)
      } else {
        canCall = true
      }

      if (canCall) {
        const childLogger = logger?.child(invoke.timing).child(ability.key)

        const markTracker = (t: InvocationTracker) => {
          t[side].add(entry.trackerKey)
        }

        const isDeclarationInvoke = invoke.declaration === true
        const shouldDecrementUses = !invoke.system && !isDeclarationInvoke
        ctx.upgradeForCall(ability, childLogger?.forSide(side))
        ctx.isDeclarationInvoke = isDeclarationInvoke

        // Pre-stamp the dispatching step's frame with the post-invoke
        // resume state. If the call branches, `clonePendingSteps` deep-
        // clones this frame per branch (with its own `cloneTracker`) so
        // every branch resumes from the correct point. If the call
        // completes normally, we clear the frame below.
        //
        // Parking requires `preScriptLen > 0`: at the top level (initial
        // PREPARE or a test-driven `runAbilities`) there's no outer step
        // to come back to. We still pre-stamp for branch propagation;
        // the final step.frame is cleared on non-parked completion.
        // External invokes fired by a non-owner side don't consume the
        // alternation slot — the loop stays on that side for the next
        // dispatch. `ownerFaction === undefined` means this side doesn't
        // own the ability; combined with `invoke.external` that's the
        // cross-faction usage case.
        const stayOnSide =
          invoke.external === true && ownerFaction === undefined

        const frameTracker = step ? cloneTracker(tracker) : undefined
        if (step && frameTracker) {
          markTracker(frameTracker)
          step.frame = {
            tracker: frameTracker,
            currentSide: stayOnSide ? side : getOpponentSide(side),
            consecutiveSkips: 0,
            // Reference the live per-pass object so accumulated writes
            // travel with the frame on park/resume; deep-cloned per branch
            // by `clonePendingSteps`.
            runState: this._currentRunState,
          }
        }
        // Also mark the outer loop's tracker so the current pass
        // alternation (if we continue without branching/parking) treats
        // this ability as invoked.
        markTracker(tracker)

        try {
          inv.call(ctx, freshParams, context)

          if (shouldDecrementUses) decrementUses(state, side, ability.key, this)
          ctx.resetAfterCall()
        } catch (e) {
          if (!(e instanceof AbilityBranchInterrupt)) {
            if (step) step.frame = undefined
            throw e
          }

          ctx.resetAfterCall()

          for (const branch of e.branches) {
            const saved = this._saveBranchState()
            this._setBranchState(branch)

            if (shouldDecrementUses)
              decrementUses(branch.data, side, ability.key, this)
            branch.logger?.forSide(side).log()

            this._restoreBranchState(saved)
          }

          throw new AbilityBranchInterrupt(e.branches)
        }

        childLogger?.forSide(side).log()

        // Parked when the dispatching step is no longer on top — either a
        // trigger was pushed above it (ctx.trigger, destroy cascade) or the
        // script was dropped out from under us (ctx.transitionTo). Top-level
        // passes (step === undefined) can't park: pushed steps sit on
        // `pendingSteps` and run on the next `advance()`.
        const parked =
          step !== undefined && this._combatState.peekStep() !== step

        if (!parked && step) step.frame = undefined
        if (parked) return 'parked'
        return stayOnSide ? 'ran-stay' : 'ran'
      }
    }

    return 'skipped'
  }

  private buildInvokes(): void {
    const collections: InvokeCollections = {
      attacker: createSideInvokes(),
      defender: createSideInvokes(),
    }
    const state = this.state

    for (const side of ['attacker', 'defender'] as const) {
      const sideMap = collections[side]
      const sideData = state[side]
      const candidates = this._combatState._allInvokes[side]

      for (const candidate of candidates) {
        const mergedParams = resolveMergedParams(sideData, candidate.ability)
        if (!mergedParams) continue
        const invokes = resolveInvokes(
          candidate.ability,
          mergedParams,
          this.context(side),
        )
        const crossFaction =
          candidate.ownerFaction === undefined &&
          invokes.some(inv => inv.external === true)
        for (const invoke of invokes) {
          if (!passesInvoke(invoke, mergedParams)) continue
          if (crossFaction && invoke.external !== true) continue
          pushInvokeEntry(
            sideMap,
            buildEntry(
              candidate.ability,
              invoke,
              mergedParams,
              candidate.source,
              candidate.ownerFaction,
            ),
          )
        }
      }

      sortPreSortedBuckets(sideMap, state[side].abilities)
    }

    this._combatState._invokes = collections
    this._combatState._invokesOwned = { attacker: true, defender: true }

    this.applyAllUnitSourceSorts('attacker')
    this.applyAllUnitSourceSorts('defender')
  }

  hasCallableInvoke(timing: AbilityTiming, phase: MetaPhase[]): boolean {
    const invokes = this._combatState._invokes
    if (phase.length === 1) {
      const p = phase[0]
      const a = invokes.attacker.get(p)!.get(timing)
      if (a !== undefined && a.length > 0) return true
      const d = invokes.defender.get(p)!.get(timing)
      return d !== undefined && d.length > 0
    }
    for (let i = 0; i < phase.length; i++) {
      const p = phase[i]
      const a = invokes.attacker.get(p)!.get(timing)
      if (a !== undefined && a.length > 0) return true
      const d = invokes.defender.get(p)!.get(timing)
      if (d !== undefined && d.length > 0) return true
    }
    return false
  }

  /** Phase to use when `runAbilities` is called without an active step
   *  (e.g. the PREPARE pass at combat setup). Picks the mode-canonical phase
   *  so no-context entries — replicated into every bucket — are returned in
   *  one lookup. Returns a shared module-level array to avoid per-call alloc. */
  private defaultPhase(): MetaPhase[] {
    return this.state.combatMode === 'SPACE' ? SPACE_PHASE : GROUND_PHASE
  }

  private removeInvokeEntries(side: CombatSide, abilityKey: string): void {
    this._combatState.ensureOwnInvokes(side)
    const s = this._combatState._invokes[side]
    for (const bucket of s.values()) filterBucketByKey(bucket, abilityKey)
  }

  addAbilityInvokes(
    side: CombatSide,
    key: string,
    draft: CombatStateData,
  ): void {
    this.removeInvokeEntries(side, key)

    const allInvokes = this._combatState._allInvokes[side]
    const sideData = draft[side]
    let pushed = false

    for (const candidate of allInvokes) {
      if (candidate.ability.key !== key) continue
      const mergedParams = resolveMergedParams(sideData, candidate.ability)
      if (!mergedParams) continue
      const invokes = resolveInvokes(
        candidate.ability,
        mergedParams,
        this.context(side),
      )
      const crossFaction =
        candidate.ownerFaction === undefined &&
        invokes.some(inv => inv.external === true)
      for (const invoke of invokes) {
        if (!passesInvoke(invoke, mergedParams)) continue
        if (crossFaction && invoke.external !== true) continue
        if (!pushed) {
          this._combatState.ensureOwnInvokes(side)
          pushed = true
        }
        pushInvokeEntry(
          this._combatState._invokes[side],
          buildEntry(
            candidate.ability,
            invoke,
            mergedParams,
            candidate.source,
            candidate.ownerFaction,
          ),
        )
      }
    }

    if (pushed) {
      sortPreSortedBuckets(
        this._combatState._invokes[side],
        draft[side].abilities,
      )
      this.applyUnitSourceSort(side, key)
    }
  }

  removeAbilityInvokes(side: CombatSide, key: string): void {
    this.removeInvokeEntries(side, key)
  }

  /** Register a new variant's unit-source candidates for the given unit IDs
   *  and refresh emitted invokes for affected ability keys. Removes any prior
   *  unit-source candidates for the same IDs so variant changes
   *  (modifyUnitType) replace rather than duplicate. Immediate — no queue. */
  addUnitInvokes(
    side: CombatSide,
    variantKey: string,
    unitIds: UnitId[],
  ): void {
    this._combatState.ensureOwnAllInvokes()
    const state = this._combatState.data
    const sideState = state[side]
    const allInvokes = this._combatState._allInvokes[side]

    const affectedKeys = new Set<string>()
    const idSet = new Set<UnitId>(unitIds)

    // Remove old unit-source candidates for these unit IDs; remember their
    // ability keys so we re-register downstream (handles modifyUnitType
    // variant changes where old and new abilities may differ).
    const filtered = allInvokes.filter(c => {
      if (c.source.type === 'unit' && idSet.has(c.source.unitId)) {
        affectedKeys.add(c.ability.key)
        return false
      }
      return true
    })
    if (filtered.length !== allInvokes.length) {
      this._combatState._allInvokes[side] = filtered
    }

    // Add new candidates for the new variant's abilities.
    const stats = resolveUnitStats(sideState.unitStats, variantKey as UnitType)
    if (stats?.ABILITIES) {
      const { type: baseType } = parseVariantId(variantKey as UnitType)
      for (const ability of stats.ABILITIES) {
        if (ability.context && ability.context !== state.combatMode) continue
        affectedKeys.add(ability.key)
        for (const unitId of unitIds) {
          this._combatState._allInvokes[side].push({
            ability,
            source: {
              type: 'unit',
              unitType: baseType as UnitBaseType,
              unitId,
            },
            ownerFaction: sideState.faction,
          })
        }
      }
    }

    for (const key of affectedKeys) {
      this.addAbilityInvokes(side, key, state)
    }
  }

  /** Remove unit-source candidates for the given unit IDs and refresh emitted
   *  invokes for affected ability keys. Used by the DESTROY cascade cleanup
   *  so dead units' entries don't accumulate in `_allInvokes` / `_invokes`.
   *
   *  Fast path: rather than rebuilding entries for each affected ability key
   *  (which re-walks `_allInvokes` and re-sorts buckets), we drop the dead
   *  units' entries directly from `_invokes`. Surviving units' entries
   *  retain their pre-computed params, their bucket positions, and their
   *  unit-source sort order — removing items doesn't reorder the rest. The
   *  rebuild was a no-op for surviving entries (ability config didn't
   *  change just because a unit died); skipping it removes the per-DESTROY
   *  `addAbilityInvokes` / `applyUnitSourceSort` cost that dominates the
   *  [0.0.1] profile when 5+ dreads die across a round. */
  removeUnitInvokes(side: CombatSide, unitIds: UnitId[]): void {
    if (unitIds.length === 0) return

    // Fast skip: when none of the dead units have unit-source candidates
    // (e.g. fighter destroys with no per-unit abilities), the filter walk
    // below would produce no removals — short-circuit before touching the
    // CoW machinery. The unit-presence set is cached per `_allInvokes`
    // array reference so siblings sharing the same CoW snapshot reuse it.
    const presentUnits = this._getUnitsWithCandidates(side)
    let anyMatch = false
    for (let i = 0; i < unitIds.length; i++) {
      if (presentUnits.has(unitIds[i])) {
        anyMatch = true
        break
      }
    }
    if (!anyMatch) return

    this._combatState.ensureOwnAllInvokes()
    const allInvokes = this._combatState._allInvokes[side]
    const idSet = new Set<UnitId>(unitIds)
    const removed: AbilityCandidate[] = []

    const filtered = allInvokes.filter(c => {
      if (c.source.type === 'unit' && idSet.has(c.source.unitId)) {
        removed.push(c)
        return false
      }
      return true
    })
    if (removed.length === 0) return
    this._combatState._allInvokes[side] = filtered

    // Limit the bucket sweep to the (phase, timing) tuples that actually
    // have entries to remove. Without this, the destroy cleanup walks all
    // 7 phases × every timing per call, which dominates the [0.0.1] profile
    // when 5+ dreads die at once. Multiple dead candidates typically share
    // the same `Ability` reference (e.g. all 5 dreads have SUSTAIN_DAMAGE),
    // so we dedup at the ability level — one pass per unique ability,
    // regardless of how many of its source units died.
    this._combatState.ensureOwnInvokes(side)
    const sideInvokes = this._combatState._invokes[side]

    const seenAbilities = new Set<Ability>()
    for (let ri = 0; ri < removed.length; ri++) {
      const ability = removed[ri].ability
      if (seenAbilities.has(ability)) continue
      seenAbilities.add(ability)
      // Unit-sourced candidates never use the factory form — only config
      // abilities may resolve invokes dynamically.
      if (!hasStaticInvokes(ability)) continue
      const invokes = ability.invoke
      for (let ii = 0; ii < invokes.length; ii++) {
        const invoke = invokes[ii]
        const timing = invoke.timing
        const parent = MERGED_PARENT_BY_TIMING[timing]
        const ctx = invoke.context
        const phases: readonly MetaPhase[] = !ctx
          ? ALL_META_PHASES
          : typeof ctx === 'string'
            ? [ctx]
            : ctx
        for (let pi = 0; pi < phases.length; pi++) {
          const phase = phases[pi]
          const bucket = sideInvokes.get(phase)
          if (!bucket) continue
          const entries = bucket.get(timing)
          if (entries !== undefined) {
            const survivors = entries.filter(
              e => !(e.source.type === 'unit' && idSet.has(e.source.unitId)),
            )
            if (survivors.length !== entries.length) {
              if (survivors.length === 0) bucket.delete(timing)
              else bucket.set(timing, survivors)
            }
          }
          if (parent !== undefined) {
            const parentEntries = bucket.get(parent)
            if (parentEntries !== undefined) {
              const survivors = parentEntries.filter(
                e => !(e.source.type === 'unit' && idSet.has(e.source.unitId)),
              )
              if (survivors.length !== parentEntries.length) {
                if (survivors.length === 0) bucket.delete(parent)
                else bucket.set(parent, survivors)
              }
            }
          }
        }
      }
    }
  }

  /** True when the ability's invoke list is a factory, so a param change
   *  may change which invokes exist. */
  hasDynamicInvokes(side: CombatSide, key: string): boolean {
    const ability = this.abilityForKey(side, key)
    return ability !== undefined && !hasStaticInvokes(ability)
  }

  invokeOnParamSet(
    side: CombatSide,
    targetKey: string,
    changedKeys: string[],
    draft: CombatStateData,
  ): void {
    const ability = this.abilityForKey(side, targetKey)
    if (!ability?.onParamSet) return
    // Give onParamSet a mutable merged view. It writes derived fields back
    // (e.g. ships → nonFighterShips/spaceCombatParticipating). Capture any
    // mutations via a before/after diff and persist them in liveAbilities
    // so subsequent reads see the derived values.
    const params = { ...CombatSideState.getLiveParams(draft[side], targetKey) }
    const before = { ...params }
    const ctx = this.context(side)
    withRunningAbility(ctx, ability, () => {
      for (const key of changedKeys) {
        ability.onParamSet!(params, key, params[key], ctx)
      }
    })
    let liveEntry: Record<string, unknown> | undefined
    for (const key of Object.keys(params)) {
      if (params[key] !== before[key]) {
        if (!liveEntry) liveEntry = cowLiveAbilityEntry(draft, side, targetKey)
        liveEntry[key] = params[key]
      }
    }
  }

  /** Resolve invoke entries for `timing` on `side`, scoped to `phase`.
   *  Hot path — denormalized so the common single-phase case returns via one
   *  `byPhase.get(phase).get(timing)` lookup (no-context entries are
   *  replicated into every phase bucket at build time). Multi-phase stacks
   *  (unit-ability meta nested inside SPACE_COMBAT/GROUND_COMBAT) walk each
   *  phase; the tracker dedupes replicated no-context entries at invoke
   *  time. For pre-sorted timings with a cross-bucket merge we re-sort so
   *  ABILITY_ORDER is honored across buckets. */
  private getInvokesForTiming<T extends AbilityTiming>(
    timing: T,
    side: CombatSide,
    phase: MetaPhase[],
  ): TimingInvokeEntry[] {
    const s = this._combatState._invokes[side]

    if (phase.length === 1) {
      return s.get(phase[0])!.get(timing) ?? []
    }

    const lists: TimingInvokeEntry[][] = []
    for (const p of phase) {
      const entries = s.get(p)!.get(timing)
      if (entries) lists.push(entries)
    }
    if (lists.length === 0) return []
    if (lists.length === 1) return lists[0]
    const merged: TimingInvokeEntry[] = []
    for (const l of lists) merged.push(...l)
    if (SORT_KEY_BY_TIMING.has(timing)) {
      sortBucket(merged, this._combatState.data[side].abilities, timing)
    }
    return merged
  }

  /** Reorder unit-sourced entries of `abilityKey` in every phase/timing
   *  bucket on `side` using the ability's `sort` function. No-op when the
   *  ability doesn't define `sort`. Called at bucket construction (build
   *  and on re-registration) so dispatch iterates entries in the
   *  pre-sorted order. */
  private applyUnitSourceSort(side: CombatSide, abilityKey: string): void {
    const ability = this.abilityForKey(side, abilityKey)
    if (!ability?.sort) return

    const sideMap = this._combatState._invokes[side]
    const state = this._combatState.data
    const liveOverlay = state[side].liveAbilities[abilityKey]
    const ctx = this.context(side)

    for (const bucket of sideMap.values()) {
      for (const entries of bucket.values()) {
        if (entries.length < 2) continue

        const positions: number[] = []
        for (let i = 0; i < entries.length; i++) {
          const e = entries[i]
          if (e.source.type === 'unit' && e.ability.key === abilityKey) {
            positions.push(i)
          }
        }
        if (positions.length < 2) continue

        const firstEntry = entries[positions[0]]
        const mergedParams = liveOverlay
          ? { ...firstEntry.params, ...liveOverlay }
          : firstEntry.params

        const unitIds: UnitId[] = new Array(positions.length)
        const entryByUnit = new Map<UnitId, TimingInvokeEntry>()
        for (let i = 0; i < positions.length; i++) {
          const e = entries[positions[i]]
          const id = (e.source as { type: 'unit'; unitId: UnitId }).unitId
          unitIds[i] = id
          entryByUnit.set(id, e)
        }

        ctx.unitSource = undefined
        ctx.ownerFaction = firstEntry.ownerFaction
        ctx.ability = ability
        // oxlint-disable-next-line typescript/no-explicit-any
        const sortedIds = (ability.sort as any)(mergedParams, ctx, unitIds)

        for (let i = 0; i < positions.length; i++) {
          const mapped = entryByUnit.get(sortedIds[i])
          if (mapped) entries[positions[i]] = mapped
        }
      }
    }
  }

  /** Apply `ability.sort` to every ability that declares one, for this side.
   *  Called once after `buildInvokes` populates all buckets. */
  private applyAllUnitSourceSorts(side: CombatSide): void {
    for (const ability of this._abilities[side]) {
      if (ability.sort) this.applyUnitSourceSort(side, ability.key)
    }
  }
}
