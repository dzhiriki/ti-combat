import type { UnitCategory } from '@/constants/units'
import type {
  CombatSide,
  UnitAbility,
  UnitBaseType,
  UnitCombatOverrides,
  UnitId,
  UnitIdList,
  UnitState,
  UnitStats,
  UnitType,
} from '@/types'
import type { SurfaceDefinition, SurfaceId } from '@/types'

import type {
  AbilitiesOverride,
  AbilityPassFrame,
  AbilityTiming,
} from '../abilities-engine'
import type { HitsDist } from '../dice-math/reroll-strategy'
import type { ModifierDecl } from '../dice-math/types'
// `PhaseStep` references `CombatState` in its method `fn` signature; the
// import is type-only to avoid a runtime cycle.
import type { CombatState, StateWithProbability } from './combat-state'

/**
 * Combat mode determines which meta-phase flow to use.
 * - SPACE: Space combat between ships (Space Cannon Offense -> Space Combat)
 * - GROUND: Ground combat on planets (Bombardment -> Space Cannon Defense -> Ground Combat)
 */
export type CombatMode = 'SPACE' | 'GROUND'

/** Subset of MetaPhase that can be used with AbilityCallContext.resolveStep. */
export type UnitAbilityMeta =
  | 'BOMBARDMENT'
  | 'AFB'
  | 'SPACE_CANNON_OFFENSE'
  | 'SPACE_CANNON_DEFENSE'

/**
 * MetaPhase represents the major combat stages in TI4.
 *
 * Space Combat flow:
 * - SPACE_CANNON_OFFENSE: PDS fire at ships before combat begins
 * - AFB: Anti-Fighter Barrage (occurs during round 1 of space combat)
 * - SPACE_COMBAT: Standard space combat rounds
 *
 * Ground Combat flow:
 * - BOMBARDMENT: Ships with bombardment fire at ground forces
 * - SPACE_CANNON_DEFENSE: Defender's PDS fire at invading ground forces
 * - GROUND_COMBAT: Standard ground combat rounds
 *
 * Completion is tracked out-of-band via `CombatStateData.isFinished`, not a
 * dedicated meta. Phase-flow helpers (`getNextPhaseInFlow`) and transition
 * targets use `MetaPhase | 'COMPLETE'`; 'COMPLETE' is a completion signal,
 * never a real script-driven meta.
 */

export type MetaPhase =
  | 'SPACE_COMBAT'
  | 'COMMIT_UNITS'
  | 'GROUND_COMBAT'
  | UnitAbilityMeta

/** Where a transition can point: any real meta, or the `'COMPLETE'` sentinel
 *  that signals "run the end-of-combat cleanup and mark combat finished." */
export type PhaseTransitionTarget = MetaPhase | 'COMPLETE'

/** Meta-phases that correspond to unit ability rolls (bombardment, space cannon, AFB). */
export const UNIT_ABILITY_PHASES: MetaPhase[] = [
  'SPACE_CANNON_OFFENSE',
  'AFB',
  'BOMBARDMENT',
  'SPACE_CANNON_DEFENSE',
]

/**
 * PhaseMarker names a transient sub-step within a meta-phase. Only used by
 * the engine and test harness to navigate within a script; not part of the
 * authoritative combat state data.
 */
export type PhaseMarker = 'START' | 'DICE_ROLL' | 'ASSIGN_HITS' | 'END'

/** An ability-owned restricted sub-pool within the main HitPool. Each
 *  entry has its own `unitPriority` list (drain order) and is keyed by
 *  the producing ability so it can be modified later (e.g. [0.0.1] lifts
 *  its restriction by merging the entry into the main pool when the
 *  flagship is destroyed). */
export interface CustomHitPool {
  key: string
  base: number
  unitPriority: UnitType[]
}

/** All supplied conditions must match the actual target unit. */
export interface UnitTargetFilter {
  types?: readonly UnitType[]
  excludeTypes?: readonly UnitType[]
  unitAbility?: boolean
}

/** A pool of unassigned hits.
 *  `base` = from dice rolls; `additional` = from abilities.
 *  X-89-style hit doubling only doubles `base`.
 *  `targetFilter`, when present, belongs to the assignment phase and applies
 *  to the main pool and every custom entry. Custom entries additionally carry
 *  their own `unitPriority` and drain after the main pool, in declaration
 *  order. */
export interface HitPool {
  base: number
  additional: number
  custom: CustomHitPool[]
  /** Eligibility imposed by the current assignment phase. */
  targetFilter?: UnitTargetFilter
}

/** A single restriction entry explaining why an ability is restricted */
export interface RestrictionEntry {
  reason: string
  unitType?: UnitBaseType
  category?: UnitCategory
  /** Omitted restrictions apply globally. */
  surfaceId?: SurfaceId
}

/** "This unit type ignores every restriction coming from `reason`."
 *  Applied when the raw entries are resolved, so it is order-independent —
 *  the immunity can be declared before or after the restriction itself
 *  (e.g. the Il Na Viroset flagship ignoring an Entropic Scar). */
export interface RestrictionImmunity {
  reason: string
  unitType: UnitBaseType
}

/** Two-layer restriction system for unit abilities, plus per-source
 *  immunities that carve unit types back out of both layers. */
export interface UnitAbilityRestrictions {
  cannotBeUsed?: Partial<Record<UnitAbility, RestrictionEntry[]>>
  lost?: Partial<Record<UnitAbility, RestrictionEntry[]>>
  immune?: RestrictionImmunity[]
}

export type ResolvedRestrictionScope = Set<UnitType | UnitId> | 'ALL'

/** Resolved restrictions for one unit ability. Global restrictions are
 *  checked for every unit; surface restrictions are checked only for units
 *  physically located on that surface. */
export interface ResolvedAbilityRestriction {
  global?: ResolvedRestrictionScope
  surfaces?: Map<SurfaceId, ResolvedRestrictionScope>
}

/** Resolved form of `UnitAbilityRestrictions`, derived from the raw entries,
 *  current unit composition, and live SETTINGS. */
export type ResolvedRestrictionsLayer = Map<
  UnitAbility,
  ResolvedAbilityRestriction
>
export interface ResolvedRestrictions {
  cannotBeUsed: ResolvedRestrictionsLayer
  lost: ResolvedRestrictionsLayer
}

/** A stats entry: either concrete stats or a factory that derives from parent type stats */
export type UnitStatsEntry = UnitStats | ((parentStats: UnitStats) => UnitStats)

/** Ability configuration for one side (key → params). */
export type SideAbilitiesConfig = Record<string, Record<string, unknown>>

/** State data for one side of combat */
export interface SideStateData {
  faction: string
  /** Authoritative physical membership. Every living unit appears in exactly
   *  one surface list. `unitSurface` retains the last location of destroyed
   *  ids so destroy reactions can still inspect where their source was. */
  surfaceUnits: Record<string, UnitIdList>
  unitSurface: Record<string, SurfaceId>
  /** Participating UnitIds packed into a `UnitIdList` (one UTF-16 char
   *  per UnitId), pre-sorted by combat-mode priority. Highest priority
   *  first, lowest last. `slice(0, -N)` keeps the N highest-priority
   *  units (the lowest-priority ones die first under tail-slice
   *  assign-hits). Stored as a packed string so it can be concatenated
   *  directly into the state-identity hash without conversion. */
  participatingUnits: UnitIdList
  /** Non-participating UnitIds packed into a `UnitIdList` (one UTF-16
   *  char per UnitId), for the current combat mode (e.g. ships during
   *  ground combat). They can still fire unit abilities (bombardment,
   *  SCO/SCD) but are never targeted by normal combat hits. Unsorted. */
  nonParticipatingUnits: UnitIdList
  /** UnitId → variant key. Populated at setup. Stale entries for
   *  destroyed units are NEVER cleaned — do not use as an "alive" set.
   *  Typed as `Record<string, UnitType>` so callers iterating a packed
   *  UnitId string can index without re-branding each char. */
  unitType: Record<string, UnitType>
  /** UnitId → per-unit mutable state (flat map, sparse — only entries with non-default state) */
  unitState: Record<string, UnitState>
  /** Sparse, copy-on-write instance grants; retained for destroy reactions. */
  unitCombat?: Record<string, UnitCombatOverrides>
  /** Variant key → shared stats template (may be a factory for subtypes) */
  unitStats: Record<UnitType, UnitStatsEntry>
  /** The side's pending hit pool, or undefined when no hits are queued.
   *  At most one pool is alive at a time; abilities that produce
   *  type-restricted hits via `addHits(n, types)` must do so when the
   *  pool is undefined (the API throws otherwise). */
  hitPool?: HitPool
  unitAbilityRestrictions?: UnitAbilityRestrictions
  /** Initial ability config for this side, set once at combat start.
   *  Immutable during the run — runtime mutations (isEnabled, uses,
   *  ability-specific fields) live in `liveAbilities` as partial overlays. */
  abilities: SideAbilitiesConfig
  /** Partial overlays on top of `abilities`, written via
   *  `updateAbilityConfig` and `decrementUses`. Only contains entries for
   *  abilities whose config changed during the run. Hashed into the state
   *  identity; reads must merge base+live (see `CombatSideState.getLiveParams`). */
  liveAbilities: SideAbilitiesConfig
  /** CoW marker — when true, `unitState` reference is potentially shared
   *  with another SideStateData (from a branch clone); mutations must
   *  clone first via `ensureUnitStateOwned`. */
  _unitStateShared?: boolean
  /** Variant keys whose pool needs `canonicalizeUnitState` re-run.
   *  Set when a per-unit state mutation may change a unit's destroyScore.
   *  Flushed at BEFORE_ASSIGN_HITS and on hash reads, scoped to only
   *  the affected variant pools. Replaces the previous `_needsResort` flag. */
  _needsCanonicalize?: Set<UnitType>
  /** CoW marker — when true, `hitPool` reference is potentially shared
   *  with another SideStateData; mutations must clone first via
   *  `ensureHitPoolOwned`. */
  _hitPoolShared?: boolean
  /** Cached physical-location signature used by state hashing. */
  _locationHash?: string
  /** Calculation target used to omit redundant location data when every
   *  living unit is already on the active surface. */
  _activeSurfaceId?: SurfaceId
  /** Shared intern table for immutable single-occupied-surface membership
   *  objects. It avoids allocating the same map in millions of equivalent
   *  probability branches and has no effect on state identity. */
  _surfaceUnitsCache?: Array<
    | {
        surfaceId: SurfaceId
        pool: UnitIdList
        value: Record<string, UnitIdList>
      }
    | undefined
  >
  /** Derived O(1) lookup cache for `unitAbilityRestrictions`, rebuilt
   *  lazily on first read after any mutation that could affect
   *  restriction outcomes (entries added/removed, unit composition
   *  change, SETTINGS live-param change, or cross-side restriction
   *  change that affects source-disable cascades). Not serialized;
   *  always derivable from the raw fields. */
  _resolvedRestrictions?: ResolvedRestrictions
}

/** A single step in the phase-handler script. `advance()` pops one step
 *  and runs it. Branching steps propagate the remainder to each branch.
 *
 *  `phase` is the full stack of active meta-phases for this step, ordered
 *  outer→inner. A plain SPACE_COMBAT step has `['SPACE_COMBAT']`; an AFB
 *  step nested inside SPACE_COMBAT round 1 has `['SPACE_COMBAT', 'AFB']`.
 *  Ability invokes with `context` match if any of the step's phases
 *  appears in `context`.
 *
 *  `data` carries the timing-context payload passed to `runAbilities`
 *  (e.g. the destroyed-units map for DESTROY). When a step lives inside
 *  a `PhaseStepGroup`, the step's own `data` wins if set, otherwise the
 *  group's `data` is used. Method steps ignore it. */
export type PhaseStep = { phase: MetaPhase[]; data?: unknown } & (
  | {
      kind: 'timing'
      timing: AbilityTiming
      /** In-flight pass state — populated by the ability engine when the
       *  pass parks (e.g. after `ctx.trigger`) or branches; consumed on
       *  resume. Cloned per-branch through `clonePendingSteps` so each
       *  branch carries its own resume point. */
      frame?: AbilityPassFrame
      /** Resolution-scoped, immutable ability params overrides set by
       *  `resolveStep`'s `abilitiesOverride`. Highest precedence (over base +
       *  live params) when the ability loop computes `freshParams`. */
      abilitiesOverride?: Readonly<AbilitiesOverride>
    }
  | {
      kind: 'method'
      fn: (
        this: CombatState,
        phase: MetaPhase[],
        payload?: unknown,
      ) => StateWithProbability[] | void
      payload?: unknown
    }
)

/** A bundle of PhaseStep entries that share `data`. When the group
 *  executes, each inner timing step receives the group's `data` as the
 *  `context` arg to `runAbilities` (e.g. the destroyed-units map for
 *  DESTROY / WHEN_DESTROY / AFTER_DESTROY), unless the step carries its
 *  own `data`. The group is popped once its `steps` drains, discarding
 *  the data. */
export interface PhaseStepGroup {
  kind: 'group'
  data: unknown
  steps: PhaseStep[]
}

/** Entry on the pending-steps stack — either a standalone step or a
 *  group of steps sharing a context. */
export type PendingStep = PhaseStep | PhaseStepGroup

/** Group context for a dice-roll group (combat or unit-ability).
 *  Seeded by the group builder with invariant params; `_collectDice`
 *  populates `diceCollection` / `unitIndex` / `validTargets`; BEFORE
 *  timing abilities read/mutate the collection via the SideApi (no direct
 *  pool access); `_rollDice` hands the collection to the math kernel. */
export interface DiceRollContext {
  hitSource: HitSource
  firing: CombatSide[]
  /** Proxima-style self-target roll: hits are produced against the natural
   *  opponent (then swapped to the firer post-roll by `_swapHitPools`), but
   *  ADD_DICE_COUNT suppression and the reroll-spec flip apply as if the
   *  firer shoots itself. */
  selfTarget?: boolean
  customDice?: {
    attacker: import('../dice-math/types').SideDiceCollection
    defender: import('../dice-math/types').SideDiceCollection
  }
  allowedUnitTypes?: ReadonlySet<UnitBaseType>
  /** Restrict dice-producing units to these physical surfaces. */
  sourceSurfaceIds?: ReadonlySet<SurfaceId>
  isUnitAbility: boolean
  /** Per-side dice collection in the kernel-native format. Populated by
   *  `_collectDice`; mutated in place by BEFORE-timing API calls. */
  diceCollection?: {
    attacker: import('../dice-math/types').SideDiceCollection
    defender: import('../dice-math/types').SideDiceCollection
  }
  validTargets?: { attacker: UnitType[]; defender: UnitType[] }
  /** Per-landing-side marginal of main base hits, captured by
   *  `_branchesFromMathKernel` after the math kernel runs. Read at
   *  AFTER_DICE_ROLL_STEP by abilities that gate on the realized roll's
   *  odds (Thundarian). Recomputing from `diceCollection` would be wrong:
   *  the kernel applies dice-shape / hit-value / conditional /
   *  additional-hit-pool modifiers inside `_rollDice`, so the collection
   *  does not reflect the true post-modifier odds. */
  hitDistribution?: { attacker: HitsDist; defender: HitsDist }
  /** Declarations queued by dice-related ability APIs (applyBonusToResult,
   *  addDiceCount, declareReroll, etc.). Consumed by `_rollDice` in push
   *  order. Dropped when the group drains. */
  modifiers?: ModifierDecl[]
  /** Resolution-scoped params overrides set by `resolveStep`'s
   *  `abilitiesOverride`. Consumed by `_rollDice` to override the hit-assignment
   *  priority list (UNIT_PRIORITY) for this unit-ability resolution. */
  abilitiesOverride?: Readonly<AbilitiesOverride>
}

/** Type guard used by `SideApi.getDicePool` to recognize a dice-roll
 *  group's context on top of `pendingSteps`. */
export function isDiceRollContext(ctx: unknown): ctx is DiceRollContext {
  return (
    typeof ctx === 'object' &&
    ctx !== null &&
    'isUnitAbility' in ctx &&
    'hitSource' in ctx
  )
}

/** Complete combat state data */
export interface CombatStateData {
  attacker: SideStateData
  defender: SideStateData
  combatMode: CombatMode
  surfaces: SurfaceDefinition[]
  /** Space for SPACE mode, or the planet whose invasion is being resolved. */
  activeSurfaceId: SurfaceId
  /** The side that won, or 'draw'. Set whenever a side is wiped (via
   *  `_removeOne` or `_postAssignHits`) or via an ability's `transitionTo`.
   *  Guaranteed to be defined whenever `isFinished` is true — combat
   *  cannot complete without it (the completion script is only pushed by
   *  `_triggerCompletion`, which sets this if it isn't already set). */
  winnerSide?: CombatSide | 'draw'
  /** True once combat has completed — set by `_setComplete` after the
   *  END_OF_COMBAT / CLEANUP_ROUND / CLEANUP timings run. Engine/test
   *  harness check this instead of reading the (now-removed) `currentPhase`. */
  isFinished?: boolean
  /** Next codepoint to mint as a `UnitId` when either side places new
   *  units. Shared across both sides so cross-side IDs never collide,
   *  and carried with the state so branched sibling states inherit the
   *  same starting value — equivalent placement paths produce equivalent
   *  IDs and converge through `getUnitsHash`. */
  _nextCode?: number
}

/** Hit source determines dice collection */
export type HitSource = 'COMBAT' | 'AFB' | 'BOMBARDMENT' | 'SPACE_CANNON'
