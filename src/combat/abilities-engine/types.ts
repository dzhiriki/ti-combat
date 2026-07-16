import type {
  CombatSide,
  DiceGroup,
  UnitBaseType,
  UnitId,
  UnitStats,
  UnitType,
  UnitVariantId,
} from '@/types'

import type {
  CombatMode,
  CombatStateData,
  HitSource,
  MetaPhase,
  UnitAbilityMeta,
} from '../combat-state/types'
import type { Logger } from '../logger'
import type { AbilitySlot } from './ability-slot'
import type { SideApi } from './api/ability-api'
import type { ParamLimit } from './param-limit'

export type { AbilitySlot }

export type SyncSortSpec =
  | 'worth-asc'
  | 'worth-desc'
  | 'normal-asc'
  | 'normal-desc'
  | ((a: UnitBaseType, b: UnitBaseType) => number)

/** Variant-list filter shape — shared between `SideApi.getUnitVariantsOptions`
 *  and `declareParam({ filter })`. The same options control which variants
 *  appear in the UI list and which are kept in the synced consumer params. */
export interface ParamFilter {
  include?: UnitType[]
  exclude?: UnitType[]
  excludeSubtypes?: UnitVariantId[]
  excludeSubtypeSource?: string[]
  includeSubtypes?: UnitVariantId[]
  combatMode?: CombatMode
  includeNonParticipating?: boolean
  includeOnlyBaseTypes?: boolean
  /** When true, variants whose per-variant `limit` (set on the owning
   *  `declareParam`) resolves to 0 are dropped. No-op when `limit` is unset
   *  or when the filter is used standalone (no associated paramKey). */
  includeOnlyAvailable?: boolean
}

export interface SyncSourceConfig<
  K extends keyof SettingsParams = keyof SettingsParams,
> {
  key: string
  group: K
  side: 'own' | 'opponent'
  sort: SyncSortSpec
  /** Default for the value slot when reconcile adds a new tuple entry to a
   *  `UnitList<V>` param. Inheritance from a parent variant (e.g. base
   *  `DREADNOUGHT` for `DREADNOUGHT:Galvanized`) takes precedence; this
   *  is the fallback. Omit for order-mode lists. */
  defaultItemValue?: unknown
  compute?: (value: SettingsParams[K]) => unknown
  filter?: ParamFilter
  /** See `declareParam.limit`. Threaded through so reconcile can clamp
   *  stored values to the per-variant max. */
  limit?: ParamLimit
}

export interface DeclaredSubtype {
  name: UnitVariantId
  unitType: UnitType
  /** When false, the subtype is registered but treated as inactive: UI
   *  consumers (`getUnitVariantsOptions`) and `declareParam(source: ...)`
   *  reconciliation hide it unless the caller passes
   *  `includeNonParticipating: true`. Required — every declarer makes an
   *  explicit choice. */
  participating: boolean
  /** Factory that computes the variant's stats from its parent variant's
   *  stats. Invoked once at config time (`buildSideState`) so runtime callers
   *  (`addSubtype`, `placeUnits` with variant keys) don't need to supply a
   *  factory — `s.unitStats[variantKey]` is always pre-populated. */
  statsFactory: (parentStats: UnitStats) => UnitStats
  /** Ability key that declared this subtype — auto-populated by the reconcile
   *  pass from `ability.declareSubtype`. Abilities don't set this
   *  themselves. Used by `excludeSubtypeSource` on `getUnitVariantsOptions`
   *  so an ability can hide its own declarations while keeping equivalent
   *  declarations from other abilities visible. */
  source?: string
}

export type SettingsParams = {
  nonFighterShips: UnitBaseType[]
  ships: UnitBaseType[]
  groundForces: UnitBaseType[]
  structures: UnitBaseType[]
  units: UnitBaseType[]
  spaceCombatParticipating: UnitBaseType[]
  groundCombatParticipating: UnitBaseType[]
  validTargetsSpaceCannonOffense: UnitBaseType[]
  validTargetsBombardment: UnitBaseType[]
  validTargetsSpaceCannonDefense: UnitBaseType[]
  validTargetsAntiFighterBarrage: UnitBaseType[]
  subtypes: DeclaredSubtype[]
}

type ParamChangeKey = Exclude<keyof SettingsParams, 'subtypes'>

export type ParamChange = {
  [K in ParamChangeKey]: {
    key: K
    value: SettingsParams[K] extends (infer E)[] ? E : SettingsParams[K]
  }
}[ParamChangeKey]

// Sided context (external API - attacker/defender perspective)
export interface SidedContext<T> {
  attacker: T
  defender: T
}

// Own/Opponent context (ability perspective - relative to current side)
export interface OwnOpponentContext<T> {
  own: T
  opponent: T
}

// Dice pool: kept as the DICE_POOL log shape only — the dice-roll
// pipeline now uses `SideDiceCollection` end-to-end. Tests read this
// shape via `t.dicePool()`. Each entry is `[hitValue, totalDpu]` (dpu
// already includes any bonus dice).
export type DicePool = Partial<Record<string, DiceGroup[]>>

// Single source of truth — map timing to context type (external API uses sided format).
// void = no context, other type = required context.
// Declared globally so ability files can add their own timings via interface
// merging without touching this core list. See pre-galvanized.ts for an example.
declare global {
  interface TimingContextMap {
    PREPARE: void
    START_OF_COMBAT: void
    START_OF_COMBAT_ROUND: void
    ANNOUNCE_RETREAT_STEP: void
    BEFORE_DICE_ROLL: void
    REROLL_DICE_ROLL: void
    AFTER_DICE_ROLL: void
    BEFORE_ASSIGN_HITS: void
    AFTER_ASSIGN_HITS_STEP: void
    RETREAT_STEP: void
    END_OF_COMBAT_ROUND: void
    END_OF_COMBAT: void
    AFTER_COMBAT_ROUND: void
    CLEANUP_ROUND: void
    CLEANUP: void

    AFTER_DICE_ROLL_STEP: void

    BEFORE_UNIT_ABILITY_ROLL: void
    REROLL_UNIT_ABILITY_ROLL: void
    AFTER_UNIT_ABILITY_ROLL: void

    AFB_STEP: void
    BOMBARDMENT_STEP: void
    SPACE_CANNON_OFFENSE_STEP: void
    SPACE_CANNON_DEFENSE_STEP: void

    DESTROY: UnitId[]
    WHEN_DESTROY: UnitId[]
    AFTER_DESTROY: UnitId[]

    COMMIT_UNITS: void
  }

  /** Per-ability params registry. Each ability file augments this with its
   *  own `Params` type so `getAbilityConfig(key)` returns the correct shape.
   *  The returned value is also intersected with `AbilityBaseParams`
   *  (`isEnabled`, `uses`) by the API signature. */
  interface AbilityConfigMap {
    SETTINGS: SettingsParams
  }
}

export type AbilityTiming = keyof TimingContextMap

// ============================================================================
// CONTEXT TYPES
// ============================================================================

export interface RuntimeAbilityList {
  /** Flat list of all abilities for this side. */
  readonly all: readonly Ability[]
  /** Faction agent abilities (slot === 'AGENT'). */
  readonly agents: readonly Ability[]
  /** Faction commander abilities (slot === 'COMMANDER'). */
  readonly commanders: readonly Ability[]
  /** Faction promissory abilities (slot === 'PROMISSORY'). */
  readonly promissories: readonly Ability[]
}

/** Read-only context for isCallable (no Immer, no mutations) */
export interface AbilityReadContext {
  readonly state: Readonly<CombatStateData>
  readonly api: {
    readonly own: SideApi
    readonly opponent: SideApi
  }
  readonly utils: import('./api/ability-utils').AbilityUtils
  /** Innermost active meta-phase for the currently-running ability
   *  (e.g. 'AFB' when the phase stack is ['SPACE_COMBAT', 'AFB']). */
  readonly meta: MetaPhase
  /** The absolute CombatSide this ability is currently running on. */
  readonly side: CombatSide
  /** All abilities registered for each side — available regardless of enabled state.
   *  Use for UI generation (e.g., selects listing agents from both sides). */
  readonly abilities: OwnOpponentContext<RuntimeAbilityList>
  /** Reference to the ability that is currently running — set by the engine
   *  before each `isCallable`/`call` invocation and by the UI before `uiConfig`.
   *  Lets helpers like `excludeSubtypeSource: [ctx.this.key]` stay generic. */
  readonly this: Ability
  /** UnitId the ability is attached to, or `undefined` for config-sourced
   *  candidates (including the external-invoke no-unit fallback). */
  readonly unitSource: UnitId | undefined
  /** Get the UnitId this ability is attached to. Throws if called from a non-unit ability. */
  getUnit(): UnitId
  /** Get enabled config abilities matching the given timing(s) for the current side. */
  getAbilitiesForTiming(
    timing: AbilityTiming | AbilityTiming[],
  ): { key: string; name: string }[]
  /** Returns true if the current side's faction owns this ability (faction or unit ability). */
  isOwner(): boolean
  /** Phase stack of the current dice-roll group. Throws outside a dice-roll group. */
  readonly currentDiceRollPhase: MetaPhase[]
  /** Sides firing in the current dice-roll group. Throws outside one. */
  readonly currentDiceRollFiring: CombatSide[]
  /** Hit source of the current dice-roll group. Throws outside one. */
  readonly currentDiceRollHitSource: HitSource
  /** Whether the current dice-roll group is a Proxima-style self-target roll. Throws outside one. */
  readonly currentDiceRollSelfTarget: boolean
  /** Whether the current dice-roll group is a unit-ability roll. Throws outside one. */
  readonly currentDiceRollIsUnitAbility: boolean
  /** Own/opponent base-hit snapshot for strategy gating at
   *  AFTER_DICE_ROLL_STEP. `own` = hits THIS side produced (landing on the
   *  opponent); `opponent` = hits the other side produced. Totals read
   *  main `hitPool.base` to match the captured `.base` marginal. Throws
   *  outside a dice-roll group or before the distribution was captured. */
  getPostRollSides(): {
    own: import('../dice-math/reroll-strategy').RerollSide
    opponent: import('../dice-math/reroll-strategy').RerollSide
  }
}

/** Mutable context for call (Immer draft, full API) */
export interface AbilityCallContext {
  state: CombatStateData // Immer draft
  api: {
    own: SideApi
    opponent: SideApi
  }
  readonly utils: import('./api/ability-utils').AbilityUtils
  /** Innermost active meta-phase for the currently-running ability
   *  (e.g. 'AFB' when the phase stack is ['SPACE_COMBAT', 'AFB']). */
  readonly meta: MetaPhase
  /** The absolute CombatSide this ability is currently running on. */
  readonly side: CombatSide
  /** All abilities registered for each side — available regardless of enabled state. */
  readonly abilities: OwnOpponentContext<RuntimeAbilityList>
  /** Reference to the ability that is currently running — set by the engine
   *  before each `isCallable`/`call` invocation. */
  readonly this: Ability
  logger?: Logger
  /** Run abilities for the given timing inline during this call */
  trigger<K extends AbilityTiming>(name: K, context: TimingContextMap[K]): void
  /** UnitId the ability is attached to, or `undefined` for config-sourced
   *  candidates (including the external-invoke no-unit fallback). */
  readonly unitSource: UnitId | undefined
  /** Get the UnitId this ability is attached to. Throws if called from a non-unit ability. */
  getUnit(): UnitId
  /** Get enabled config abilities matching the given timing(s) for the current side. */
  getAbilitiesForTiming(
    timing: AbilityTiming | AbilityTiming[],
  ): { key: string; name: string }[]
  /** Returns true if the current side's faction owns this ability (faction or unit ability). */
  isOwner(): boolean
  /** Phase stack of the current dice-roll group. Throws outside a dice-roll group. */
  readonly currentDiceRollPhase: MetaPhase[]
  /** Sides firing in the current dice-roll group. Throws outside one. */
  readonly currentDiceRollFiring: CombatSide[]
  /** Hit source of the current dice-roll group. Throws outside one. */
  readonly currentDiceRollHitSource: HitSource
  /** Whether the current dice-roll group is a Proxima-style self-target roll. Throws outside one. */
  readonly currentDiceRollSelfTarget: boolean
  /** Whether the current dice-roll group is a unit-ability roll. Throws outside one. */
  readonly currentDiceRollIsUnitAbility: boolean
  /** Own/opponent base-hit snapshot for strategy gating at
   *  AFTER_DICE_ROLL_STEP. `own` = hits THIS side produced (landing on the
   *  opponent); `opponent` = hits the other side produced. Totals read
   *  main `hitPool.base` to match the captured `.base` marginal. Throws
   *  outside a dice-roll group or before the distribution was captured. */
  getPostRollSides(): {
    own: import('../dice-math/reroll-strategy').RerollSide
    opponent: import('../dice-math/reroll-strategy').RerollSide
  }
  /** Side-abstract reroll declaration (docs/dice-math.md §2). */
  declareReroll(spec: {
    OWN?: Omit<
      import('../dice-math/types').RerollTargetSpec,
      'key' | 'ownerSide'
    >
    OPPONENT?: Omit<
      import('../dice-math/types').RerollTargetSpec,
      'key' | 'ownerSide'
    >
  }): void
  /** Side-abstract ADDITIONAL_HIT_POOL declaration (docs/dice-math.md §2). */
  declareHitPoolTransform(spec: {
    OWN?: import('../dice-math/types').AdditionalHitPoolTargetSpec
    OPPONENT?: import('../dice-math/types').AdditionalHitPoolTargetSpec
  }): void
  /** Override the next meta-phase transition. The current round's remaining
   *  steps still complete normally; the override fires when the script's
   *  closing transition step runs. Pass `'COMPLETE'` to run end-of-combat
   *  cleanup and finish the battle.
   *  @param outcome - 'DRAW' forces a draw, 'LOST' means the calling side loses. */
  transitionTo(target: 'COMPLETE', outcome?: 'DRAW' | 'LOST'): void
  /** Roll dice mid-ability, creating probability branches.
   *  Computes all per-group outcomes and calls the callback once per outcome,
   *  passing a branch-scoped context that operates on that branch's state.
   *
   *  For multi-outcome rolls, throws AbilityBranchInterrupt after processing —
   *  nothing after rollDice() executes. For empty/single-outcome rolls, the
   *  callback runs in-place on the outer ctx and rollDice returns normally. */
  rollDice(
    dice: DiceGroup[],
    callback: (branchCtx: AbilityCallContext, hits: number[]) => void,
  ): never

  /** Queue a full unit-ability step (DICE_POOL → BEFORE_UNIT_ABILITY_ROLL →
   *  roll → AFTER_UNIT_ABILITY_ROLL → ASSIGN_HITS → AFTER_ASSIGN_HITS_STEP +
   *  destroy cascade) as nested script entries. Runs after the current
   *  ability's `call` returns: the engine parks the outer pass (pendingSteps
   *  grew) and `advance()` dispatches the pushed step before the outer pass
   *  resumes. The nested phase stack is `[...outerPhase, meta]` so invoke-
   *  level `context` filters and hit-value modifiers match.
   *
   *  Fires from the calling ability's side (`ctx.side`) by default.
   *
   *  Overrides:
   *   - `dice`   — custom dice pool for the firing side; skips collectDice
   *   - `target` — where hits land. `'OPPONENT'` (default) or `'OWN'`
   *                (self-damage, e.g. Proxima's second roll)
   *   - `firing` — sides that roll in this step. Defaults to `[ctx.side]`.
   *                Pass `['attacker', 'defender']` for a single combined
   *                roll where both sides fire simultaneously (AFB): one
   *                dice-roll group, each side's hits landing on its natural
   *                opponent. A side that opted out is dropped by the
   *                unit-ability hard-block, so per-side toggles still work.
   *   - `deferCompletionCheck` — when true, omit the post-assign-hits
   *                wipe-out check at the end of this step. Use to chain
   *                multiple `resolveStep` calls as one transaction so an
   *                early wipe in step N can't preempt step N+1 (e.g.
   *                Proxima's opp-target bomb must not end combat before
   *                the paired self-target bomb runs).
   *
   *  Composition: multiple `resolveStep` calls in one `call` execute in
   *  reverse call-order (LIFO): the last push sits on top of the script
   *  stack. To run step A before step B, push B first, then A. */
  resolveStep<M extends UnitAbilityMeta>(
    meta: M,
    overrides?: {
      dice?: DiceGroup[]
      target?: 'OWN' | 'OPPONENT'
      firing?: CombatSide[]
      deferCompletionCheck?: boolean
      /** Ability params overrides for this resolution only — immutable and
       *  applied over base + live params. Boolean shorthand = `{ isEnabled }`.
       *  e.g. `{ SUSTAIN_DAMAGE: false }` to skip Sustain for this step. */
      abilitiesOverride?: AbilitiesOverride
    },
  ): void
}

// Auto-generate invoke type for each timing
type AbilityInvokeFor<TParams, T extends AbilityTiming> = {
  timing: T
  /** Restrict this invoke to specific meta-phase(s). When set, the invoke
   *  fires only if any phase in the active phase stack matches. Nested
   *  phases propagate: AFB nested inside SPACE_COMBAT has active stack
   *  ['SPACE_COMBAT', 'AFB'], so an invoke with `context: ['SPACE_COMBAT']`
   *  still fires during AFB. */
  context?: MetaPhase | MetaPhase[]
  /** System invokes bypass the `uses` accounting — they don't decrement `uses`
   *  and aren't gated by `uses > 0`. Use for paired teardown invokes
   *  (e.g. CLEANUP_ROUND after START_OF_COMBAT_ROUND setup) so the pair counts
   *  as a single use. Rely on `isCallable` to gate firing. Default: false. */
  system?: boolean
  /** When true, this invoke fires for sides that don't own the ability
   *  (cross-faction usage). Sides running an ability they don't own dispatch
   *  ONLY external invokes; non-external ones are skipped. External invokes
   *  fired on a non-owner side don't consume the alternation slot — the
   *  loop stays on that side and dispatches its next invoke. */
  external?: boolean
  /** When true, this invoke produces a declaration (dice modifier). Its
   *  `uses` decrement is DEFERRED — the engine skips the dispatch-time
   *  decrement and bills `uses` only if the pushed declaration actually
   *  survives the dice-math kernel (i.e. its target side is firing, and
   *  for REROLLs, the per-branch rerollIf predicate fired). The existing
   *  REROLL-specific deferral special-case in the engine is replaced by
   *  this generic flag. Default: false. */
  declaration?: boolean
} & (TimingContextMap[T] extends void
  ? {
      // Void timings (PREPARE, START_OF_COMBAT, BEFORE_DICE_ROLL, etc.)
      isCallable?: (params: TParams, ctx: AbilityReadContext) => boolean
      call: (ctx: AbilityCallContext, params: TParams) => void
    }
  : {
      // Other context timings (AFTER_DESTROY)
      isCallable?: (
        params: TParams,
        ctx: AbilityReadContext,
        context: TimingContextMap[T],
      ) => boolean
      call: (
        ctx: AbilityCallContext,
        params: TParams,
        context: TimingContextMap[T],
      ) => void
    })

// Union of all timing invoke types (auto-generated)
export type AbilityInvoke<TParams = Record<string, unknown>> = {
  [K in AbilityTiming]: AbilityInvokeFor<TParams, K>
}[AbilityTiming]

interface UIConfigItemBase<TParams = Record<string, unknown>> {
  key: keyof TParams // Property name in params (e.g., 'riskDirectHit')
  label?: string // Display label (e.g., 'Risk Direct Hit?')
  /** Override the rendered default. When set, takes precedence over the
   *  value extracted from `ability.params`. Used when an ability's UI
   *  needs to mirror another ability's saved state (e.g. Ssruu). */
  defaultValue?: unknown
  /** When `false`, the item is omitted from the rendered config. */
  visible?: boolean
}

interface UIConfigCheckbox<
  TParams = Record<string, unknown>,
> extends UIConfigItemBase<TParams> {
  type: 'checkbox'
}

interface UIConfigNumber<
  TParams = Record<string, unknown>,
> extends UIConfigItemBase<TParams> {
  type: 'number'
  min?: number
  max?: number
}

export type SelectItem = { label: string; value: string }
export type SelectGroup = {
  group: string
  items: { label: string; value: string }[]
}

interface UIConfigSelect<
  TParams = Record<string, unknown>,
> extends UIConfigItemBase<TParams> {
  type: 'select'
  items: (SelectItem | SelectGroup)[]
}

export type UnitListMode = 'order' | 'checkbox' | 'number'

interface UIConfigUnitList<
  TParams = Record<string, unknown>,
> extends UIConfigItemBase<TParams> {
  type: 'unit-list'
  mode: UnitListMode
  sortable?: boolean
  items: {
    label: string
    value: string
    max?: number
    stable?: boolean
  }[]
}

export type UIConfigItem<TParams = Record<string, unknown>> =
  | UIConfigCheckbox<TParams>
  | UIConfigNumber<TParams>
  | UIConfigSelect<TParams>
  | UIConfigUnitList<TParams>

type UIConfig<Params = Record<string, unknown>> =
  | UIConfigItem<Params>[]
  | ((ctx: AbilityReadContext, params: Params) => UIConfigItem<Params>[])

/** Base params present on every ability. Managed by the tracker — abilities don't check these themselves. */
export interface AbilityBaseParams {
  isEnabled: boolean
  uses: number
}

/** Per-resolution params overrides passed to `ctx.resolveStep`. Keyed by
 *  ability key (constrained to `AbilityConfigMap`). A boolean value is
 *  shorthand for `{ isEnabled: <boolean> }`; an object is a partial params
 *  patch. Overrides are immutable for the resolution and applied over base +
 *  live params (they win over everything else). */
export type AbilitiesOverride = {
  [K in keyof AbilityConfigMap]?:
    | boolean
    | Partial<AbilityBaseParams & AbilityConfigMap[K]>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface Ability<Params extends Record<string, unknown> = any> {
  key: string
  name: string // Display name for UI
  description?: string // Tooltip text describing what the ability does
  warning?: string // Optional warning paragraph appended to the tooltip
  icon?: string // Raw SVG string for display next to name
  params: AbilityBaseParams & Params
  paramsSchema?: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    safeParse: (data: unknown) => { success: boolean; data?: any }
  }
  headerUI?: 'isEnabled' | 'uses' | (string & keyof Params) // Param key to render in header (checkbox for boolean, number input for number)
  readOnly?: boolean // Show UI but prevent user from changing the enable state
  uiConfig?: UIConfig<AbilityBaseParams & Params>
  /** Restrict ability to a specific side (attacker or defender). When set, the ability is only available to that side. */
  side?: CombatSide
  /** Restrict ability to a specific combat mode (SPACE or GROUND). When set, the ability is skipped during combat if the mode doesn't match, and dimmed in the UI. */
  context?: CombatMode
  /** When true, both sides share identical config. Changing params on one side mirrors to the other. */
  sync?: boolean
  /** Abilities sharing the same exclusiveGroup are mutually exclusive — enabling one disables others in the group. */
  exclusiveGroup?: string
  /** Called when a user changes a param. Can modify other params in response.
   *  Receives the params with the new value already applied, the changed key, and value.
   *  Return modified params or void to keep unchanged. */
  onParamSet?: (
    currentParams: AbilityBaseParams & Params,
    key: string,
    value: unknown,
  ) => (AbilityBaseParams & Params) | void
  /** Declare param changes (subtypes, group additions) based on ability params.
   *  `settings` contains the current SETTINGS values (ships, groundForces, etc.) during reconciliation. */
  declareParamChange?: (
    params: AbilityBaseParams & Params,
    settings: SettingsParams,
  ) => ParamChange[]
  /** Declare subtype variants this ability registers. Called during reconcile.
   *  Each entry's `statsFactory` is invoked once at config time to compute the
   *  variant's stats from its parent variant's stats. Subtypes are surfaced in
   *  `getUnitVariantsOptions` and pre-populated into `s.unitStats` at combat
   *  start, so runtime callers (`addSubtype`, `placeUnits` with variant keys)
   *  don't need to supply factories. */
  declareSubtype?: (params: AbilityBaseParams & Params) => DeclaredSubtype[]
  /** Pre-sort the unit-sourced invoke entries of this ability before the
   *  engine iterates them. Called with the ability's merged params, a
   *  read-only context, and the list of UnitIds that currently carry this
   *  ability on the side being dispatched. Must return the same set of ids
   *  in the desired invocation order. Use this when invocation order matters
   *  and cannot be resolved inside `isCallable` (e.g. SUSTAIN_DAMAGE uses it
   *  to prefer the highest-priority eligible unit). */
  sort?: (
    params: AbilityBaseParams & Params,
    ctx: AbilityReadContext,
    unitIds: UnitId[],
  ) => UnitId[]
  /** Destroy-prevention hook. When an OPPOSING ability directly destroys
   *  units on this ability's side via `destroyUnits` (Spark, Lash, roll
   *  triggers, ...), enabled abilities carrying this hook are consulted
   *  before the units are removed. Receives the ability's live params, the
   *  about-to-be-destroyed UnitIds, and this side's SideApi; returns the ids
   *  to spare. The engine caps the spared count at the ability's remaining
   *  `uses` and consumes one use per spared unit. Not consulted for destroys
   *  inflicted by the ability's own side (self-sacrifice costs like Devotion
   *  or Exotrireme's self-destruct) nor for hit-pool destruction — model
   *  hit-based saves with a BEFORE_ASSIGN_HITS invoke instead. */
  preventDestroy?: (
    params: AbilityBaseParams & Params,
    ids: UnitId[],
    api: SideApi,
  ) => UnitId[]
  invoke: AbilityInvoke<AbilityBaseParams & Params>[]
}

export interface RegisteredAbility {
  readonly ability: Ability
  readonly slot: AbilitySlot
}
