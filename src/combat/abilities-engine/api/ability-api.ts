import type { UnitCategory } from '@/constants/units'
import { enforceFleetPool } from '@/data/abilities/advanced/fleet-pool'
import type {
  CombatSide,
  DiceGroup,
  FactionKey,
  UnitAbility,
  UnitBaseType,
  UnitId,
  UnitState,
  UnitStats,
  UnitType,
  UnitVariantId,
} from '@/types'

import {
  CombatSideState,
  type FindUnitPredicate,
  getOpponentSide,
  type GetUnitsOptions,
} from '../../combat-side-state/combat-side-state'
import {
  buildDestroyGroup,
  clonePendingSteps,
  cloneStateForBranch,
} from '../../combat-state/combat-state'
import type {
  CombatMode,
  CombatStateData,
  DiceRollContext,
  HitSource,
  MetaPhase,
  PendingStep,
  SideStateData,
  UnitAbilityMeta,
} from '../../combat-state/types'
import { isDiceRollContext } from '../../combat-state/types'
import type { RerollSide } from '../../dice-math/reroll-strategy'
import type {
  AdditionalHitPoolTargetSpec,
  ConditionalModifierDecl,
  CustomRollDecl,
  ModifierDecl,
  RerollDecl,
  RerollTargetSpec,
  RollTriggerDecl,
  SideDiceCollection,
} from '../../dice-math/types'
import { getDiceOutcomes } from '../../dice-math/utils/get-dice-outcomes'
import type { Logger } from '../../logger'
import { canonicalizeUnitState } from '../../utils/canonicalize-unit-state'
import type {
  AbilitiesEngine,
  AbilityCandidate,
  InvokeCollections,
} from '../abilities-engine'
import type { DeclaredParamValue } from '../declare-param'
import { isDeclaredParam } from '../declare-param'
import { resolveVariantLimit } from '../param-limit'
import type {
  AbilitiesOverride,
  Ability,
  AbilityBaseParams,
  AbilityTiming,
  OwnOpponentContext,
  ParamFilter,
  RuntimeAbilityList,
} from '../types'
import { type AbilityUtils, abilityUtils } from './ability-utils'

// ============================================================================
// BRANCH TYPES
// ============================================================================

export interface AbilityBranch {
  data: CombatStateData
  invokes: InvokeCollections
  allInvokes: Record<CombatSide, AbilityCandidate[]>
  probability: number
  logger?: Logger
  /** The `pendingSteps` continuation this branch should resume with. Carried
   *  so branches that pushed script state (e.g. destroy-cascade groups from
   *  `destroyUnits` inside a rollDice callback) don't lose that state when
   *  they propagate up through `AbilityBranchInterrupt`. Optional for call
   *  sites that have no script state to forward. */
  pendingSteps?: PendingStep[]
}

/** Control-flow mechanism (not an Error — no stack trace overhead). */
export class AbilityBranchInterrupt {
  branches: AbilityBranch[]
  constructor(branches: AbilityBranch[]) {
    this.branches = branches
  }
}

// ============================================================================
// PARTICIPATION RESYNC
// ============================================================================

/** Keys whose changes alter which base types participate in the
 *  current combat mode. Only `updateAbilityConfig` writes that touch
 *  these trigger a participating/non-participating re-split. */
const SETTINGS_PARTICIPATION_KEYS = new Set([
  'ships',
  'groundForces',
  'spaceCombatParticipating',
  'groundCombatParticipating',
])
const UNIT_PRIORITY_PARTICIPATION_KEYS = new Set([
  'spaceUnitPriority',
  'groundUnitPriority',
])

function affectsParticipating(
  abilityKey: string,
  updatedKeys: readonly string[],
): boolean {
  const set =
    abilityKey === 'SETTINGS'
      ? SETTINGS_PARTICIPATION_KEYS
      : abilityKey === 'UNIT_PRIORITY'
        ? UNIT_PRIORITY_PARTICIPATION_KEYS
        : undefined
  if (!set) return false
  for (const k of updatedKeys) if (set.has(k)) return true
  return false
}

// ============================================================================
// SIDE API
// ============================================================================

export class SideApi {
  private _side: CombatSide
  private _ctx!: AbilityContext
  _abilityKey?: string
  _abilitiesParams?: AbilitiesEngine

  constructor(side: CombatSide, ctx: AbilityContext) {
    this._side = side
    this._ctx = ctx
  }

  private get _sideData(): SideStateData {
    return this._ctx.state[this._side]
  }

  private get state(): CombatStateData {
    return this._ctx.state
  }

  getFaction() {
    return this.state[this._side].faction
  }

  getUnits(unitType: UnitType, options: GetUnitsOptions) {
    return CombatSideState.getUnits(this._sideData, unitType, options)
  }

  hasUnit(unitId: UnitId) {
    return CombatSideState.hasUnit(this._sideData, unitId)
  }

  hasUnitType(unitType: UnitType, options: GetUnitsOptions) {
    return CombatSideState.hasUnitType(this._sideData, unitType, options)
  }

  countUnits(
    filter: UnitType | UnitType[] | undefined,
    options: GetUnitsOptions,
  ) {
    return CombatSideState.countUnits(this._sideData, filter, options)
  }

  getPendingHits(filter?: { base?: true; bonus?: true }) {
    return CombatSideState.getPendingHits(this._sideData, filter)
  }

  getHitPoolValidTargets() {
    return CombatSideState.getHitPoolValidTargets(this._sideData)
  }

  getActiveBaseTypes() {
    return CombatSideState.getActiveBaseTypes(this._sideData)
  }

  getParticipatingUnitTypes(options?: { combatMode?: CombatMode }) {
    return CombatSideState.getParticipatingUnitTypes(
      this._sideData,
      options?.combatMode ?? this.state.combatMode,
    )
  }

  getUnitVariantsOptions(filter?: ParamFilter): {
    label: string
    value: UnitType
  }[]
  getUnitVariantsOptions(paramKey: string): {
    label: string
    value: UnitType
    max?: number
  }[]
  getUnitVariantsOptions(arg?: ParamFilter | string) {
    if (typeof arg === 'string') {
      const declared = this._resolveDeclaredParam(arg)
      const filter = declared?.filter
      const sourceBaseTypes = declared?.source
        ? (CombatSideState.getLiveParams(this._sideData, 'SETTINGS')?.[
            declared.source
          ] as readonly UnitBaseType[] | undefined)
        : undefined
      const items = CombatSideState.getUnitVariantOptions(
        this._sideData,
        this.state.combatMode,
        filter,
        sourceBaseTypes,
      )
      if (!declared?.limit) return items
      const limit = declared.limit
      const s = this._sideData
      const withMax = items.map(item => ({
        ...item,
        max: resolveVariantLimit(limit, s, item.value),
      }))
      return declared.filter?.includeOnlyAvailable
        ? withMax.filter(item => item.max > 0)
        : withMax
    }
    return CombatSideState.getUnitVariantOptions(
      this._sideData,
      this.state.combatMode,
      arg,
    )
  }

  /** Look up the wrapped `DeclaredParamValue` for `paramKey` on the running
   *  ability. Mirrors reconcile's view so `getUnitVariantsOptions(paramKey)`
   *  can read `filter` and `limit`. Returns undefined when there is no
   *  active ability (the UI sets `ctx.ability` before calling `uiConfig`). */
  private _resolveDeclaredParam(
    paramKey: string,
  ): DeclaredParamValue<unknown> | undefined {
    const ability = this._ctx.ability
    if (!ability) return undefined
    const raw = (ability.params as Record<string, unknown>)[paramKey]
    if (!isDeclaredParam(raw)) return undefined
    return raw as DeclaredParamValue<unknown>
  }

  findUnitByPriority(
    priority: UnitType[],
    options: GetUnitsOptions & { predicate?: FindUnitPredicate },
  ): UnitId | undefined
  findUnitByPriority(
    priority: UnitType[],
    options: GetUnitsOptions & {
      amount: number
      predicate?: FindUnitPredicate
    },
  ): UnitId[]
  findUnitByPriority(
    priority: UnitType[],
    options: GetUnitsOptions & {
      amount?: number
      predicate?: FindUnitPredicate
    },
  ): UnitId | UnitId[] | undefined {
    const participating = new Set(
      CombatSideState.getParticipatingUnitTypes(
        this._sideData,
        this.state.combatMode,
      ),
    )
    return CombatSideState.findUnitByPriority(
      this._sideData,
      priority,
      participating,
      options,
    )
  }

  /** Simulate resolving N unrestricted hits against this side's current
   *  units — returns the UnitIds that would be destroyed, in sacrifice
   *  order. Non-destructive. */
  getAssignHitsTargets(hits: number): UnitId[] {
    const dirty = this._sideData._needsCanonicalize
    if (dirty) {
      canonicalizeUnitState(this._sideData, dirty)
    }
    return CombatSideState.getAssignHitsTargets(this._sideData, hits)
  }

  getUnitStats(unitTypeOrId: string | UnitId) {
    return CombatSideState.getUnitStats(this._sideData, unitTypeOrId)
  }

  getUnitVariantKey(unitId: UnitId) {
    return CombatSideState.findVariantKey(this._sideData, unitId) || undefined
  }

  getUnitState(unitId: UnitId) {
    return CombatSideState.getUnitState(this._sideData, unitId)
  }

  getUnitBaseType(unitId: UnitId) {
    return CombatSideState.getUnitBaseType(this._sideData, unitId)
  }

  isUnitAbilityLost(ability: UnitAbility, unitType: UnitType) {
    return CombatSideState.isRestricted(
      this.state,
      this._side,
      'lost',
      ability,
      unitType,
    )
  }

  isUnitAbilityCannotBeUsed(ability: UnitAbility, unitType: UnitType) {
    return CombatSideState.isRestricted(
      this.state,
      this._side,
      'cannotBeUsed',
      ability,
      unitType,
    )
  }

  getAbilityConfig<K extends keyof AbilityConfigMap>(
    key: K,
  ): AbilityBaseParams & AbilityConfigMap[K]
  getAbilityConfig(key: string) {
    return CombatSideState.getLiveParams(this._sideData, key)
  }

  /** Destroy one or more units and fire DESTROY/WHEN_DESTROY/AFTER_DESTROY
   *  exactly once for the combined set (simultaneous destruction). */
  destroyUnits(target: UnitBaseType | UnitId | UnitId[]): void {
    const s = this._sideData
    const destroyed: UnitId[] = []

    if (target === undefined) {
      return
    } else if (Array.isArray(target)) {
      for (const id of target) {
        if (!CombatSideState.findVariantKey(s, id)) continue
        destroyed.push(id)
      }
    } else if (target.length > 1) {
      // UnitId is a single-char packed token; UnitBaseType is a
      // multi-char tag like "CRUISER". Distinguish by length.
      const found = CombatSideState.findFirstUnitId(s, target as UnitBaseType)
      if (!found) return
      destroyed.push(found.unitId)
    } else {
      const unitId = target as UnitId
      if (!CombatSideState.findVariantKey(s, unitId)) return
      destroyed.push(unitId)
    }

    if (destroyed.length === 0) return

    // Direct destroys inflicted by the OTHER side may be countered by this
    // side's destroy-prevention abilities (Ability.preventDestroy) before
    // removal. Own-side destroys (self-sacrifice costs like Devotion or
    // Exotrireme's self-destruct) are never prevented.
    if (this._abilitiesParams && this._ctx.side !== this._side) {
      this._applyDestroyPrevention(destroyed)
      if (destroyed.length === 0) return
    }

    CombatSideState.removeUnits(s, destroyed)
    this._abilitiesParams?.combatState.syncWinnerSide()

    if (this._abilitiesParams) {
      this._ctx.runDestroyAbilities(destroyed)
    }
  }

  /** Consult this side's enabled `preventDestroy` abilities and drop spared
   *  ids from `destroyed` (mutated in place). Each hook may spare up to its
   *  ability's remaining `uses`; one use is consumed per spared unit. */
  private _applyDestroyPrevention(destroyed: UnitId[]): void {
    const abilities = this._abilitiesParams!.runtimeAbilityList(this._side).all
    for (const ability of abilities) {
      if (!ability.preventDestroy || destroyed.length === 0) continue
      const params = CombatSideState.getLiveParams(this._sideData, ability.key)
      if (params?.isEnabled !== true) continue
      const uses = typeof params.uses === 'number' ? params.uses : 0
      if (uses <= 0) continue
      const spared = [
        ...new Set(ability.preventDestroy(params, [...destroyed], this)),
      ]
        .filter(id => destroyed.includes(id))
        .slice(0, uses)
      if (spared.length === 0) continue
      for (const id of spared) destroyed.splice(destroyed.indexOf(id), 1)
      this.updateAbilityConfig(ability.key, {
        uses: (current: unknown) =>
          (typeof current === 'number' ? current : uses) - spared.length,
      })
      this._ctx.logger
        ?.child(ability.key)
        .forSide(this._side)
        .log({ sparedUnits: spared.length })
    }
  }

  removeUnits(target: UnitBaseType | UnitId | UnitId[]): void {
    CombatSideState.removeUnits(this._sideData, target)
  }

  placeUnits(
    unitsToAdd: Partial<Record<UnitType, number>>,
  ): Record<UnitType, UnitId[]> {
    const placed = CombatSideState.placeUnits(
      this._sideData,
      this.state.combatMode,
      unitsToAdd,
      this.state,
    )

    const abilitiesParams = this._abilitiesParams
    if (abilitiesParams) {
      for (const [variantKey, newIds] of Object.entries(placed)) {
        abilitiesParams.addUnitInvokes(this._side, variantKey, newIds)
      }
      // placeUnits appends to the tail of participatingUnits; resort so the
      // configured UNIT_PRIORITY governs hit assignment for the new units.
      abilitiesParams.combatState.resyncParticipating(this._side)
      abilitiesParams.combatState.syncWinnerSide()
    }
    enforceFleetPool(this)
    return placed as Record<UnitType, UnitId[]>
  }

  modifyUnitType(key: UnitType, updates: Partial<UnitStats>): void {
    const { keysWithAbilitiesChange } = CombatSideState.modifyUnitType(
      this._sideData,
      key,
      updates,
    )

    const abilitiesParams = this._abilitiesParams
    if (abilitiesParams) {
      for (const { key: vKey, ids } of keysWithAbilitiesChange) {
        abilitiesParams.addUnitInvokes(this._side, vKey, ids)
      }
    }
  }

  modifyUnitState(unitId: UnitId, updates: Partial<UnitState>): void {
    CombatSideState.modifyUnitState(this._sideData, unitId, updates)
  }

  /** Mark the side's unitState as needing canonicalization. The actual
   *  state-value permutation is deferred — applied just before hits
   *  resolve, or eagerly when an API consumer (`getAssignHitsTargets`)
   *  needs current order. Coalesces multiple marks per phase into one
   *  pass. Currently called by Duranium after marking `usedSustainThisRound`,
   *  which makes same-variant peers diverge in destroyScore. */
  resortUnits(unitId: UnitId): void {
    const type = this._sideData.unitType[unitId]
    if (!type) return
    const set = this._sideData._needsCanonicalize ?? new Set<UnitType>()
    set.add(type)
    this._sideData._needsCanonicalize = set
  }

  reduceHits(amount: number) {
    CombatSideState.reduceHits(this._sideData, amount)
  }

  /** Merge a custom (ability-keyed) sub-pool's hits into the main pool's
   *  `base` and drop the entry. Used by restricted-pool abilities (e.g.
   *  [0.0.1]) when the producing unit is destroyed mid-round. */
  liftHitPoolRestriction(abilityKey: string): void {
    CombatSideState.liftHitPoolRestriction(this._sideData, abilityKey)
  }

  /** Two overloads:
   *  - `addHits(n)`: adds N unrestricted ability hits to this side's
   *    main pool's `additional` slot (creates the pool if absent).
   *  - `addHits(n, types)`: creates a single restricted custom entry
   *    keyed to the calling ability, with `unitPriority = types` in the
   *    caller-given order. The landing side's `hitPool` must be
   *    undefined at call time (throws otherwise).
   *  Either form, when called while no pool exists on either side,
   *  schedules an inline assign-hits step (the `wasEmpty` path).
   *  Otherwise the in-flight dice-roll group's existing `ASSIGN_HITS`
   *  step drains everything together. */
  addHits(hits: number): void
  addHits(hits: number, validTargets: UnitType[]): void
  addHits(hits: number, validTargets?: UnitType[]): void {
    const data = this.state
    const wasEmpty =
      data.attacker.hitPool === undefined && data.defender.hitPool === undefined
    if (validTargets !== undefined && validTargets.length > 0) {
      if (this._sideData.hitPool !== undefined) {
        throw new Error(
          'addHits(n, validTargets) requires an empty hit pool on the landing side',
        )
      }
      const key = this._ctx.ability?.key ?? '__ADDED__'
      CombatSideState.addCustomHits(this._sideData, hits, key, [
        ...validTargets,
      ])
    } else {
      CombatSideState.addHits(this._sideData, hits)
    }
    if (wasEmpty && this._sideData.hitPool !== undefined) {
      this._ctx._assignHits()
    }
  }

  setUnitAbilityLost(
    ability: UnitAbility,
    reason: string,
    target?: UnitBaseType | UnitCategory,
  ) {
    CombatSideState.addRestriction(
      this.state,
      this._side,
      'lost',
      ability,
      reason,
      target,
    )
  }

  removeUnitAbilityLost(
    ability: UnitAbility,
    reason: string,
    target?: UnitBaseType | UnitCategory,
  ) {
    CombatSideState.removeRestriction(
      this.state,
      this._side,
      'lost',
      ability,
      reason,
      target,
    )
  }

  setUnitAbilityCannotBeUsed(
    ability: UnitAbility,
    reason: string,
    target?: UnitBaseType | UnitCategory,
  ) {
    CombatSideState.addRestriction(
      this.state,
      this._side,
      'cannotBeUsed',
      ability,
      reason,
      target,
    )
  }

  removeUnitAbilityCannotBeUsed(
    ability: UnitAbility,
    reason: string,
    target?: UnitBaseType | UnitCategory,
  ) {
    CombatSideState.removeRestriction(
      this.state,
      this._side,
      'cannotBeUsed',
      ability,
      reason,
      target,
    )
  }

  addSubtype(unitId: UnitId, subtype: UnitVariantId): UnitType | undefined {
    const newKey = CombatSideState.addSubtype(this._sideData, unitId, subtype)
    if (!newKey) return undefined
    // Re-register invokes for the new variant so the unit's ABILITIES set
    // matches its variant stats and per-ability `sort` runs against the
    // current variant key. Mirrors `modifyUnitType` / `placeUnits`.
    this._abilitiesParams?.addUnitInvokes(this._side, newKey, [unitId])
    // Variant-key change can move the unit to a different rank tier in
    // UNIT_PRIORITY (e.g. `CRUISER:Cavalry` ranked separately from
    // `CRUISER`); re-split so tail-slice destroys the right unit.
    this._abilitiesParams?.combatState.resyncParticipating(this._side)
    return newKey
  }

  removeSubtype(unitId: UnitId, subtype: UnitVariantId) {
    const newKey = CombatSideState.removeSubtype(
      this._sideData,
      unitId,
      subtype,
    )
    if (!newKey) return
    this._abilitiesParams?.addUnitInvokes(this._side, newKey, [unitId])
    this._abilitiesParams?.combatState.resyncParticipating(this._side)
  }

  updateAbilityConfig(
    keyOrUpdates: string | Record<string, unknown>,
    maybeUpdates?: Record<string, unknown>,
  ) {
    const state = this.state
    const side = this._side

    let targetKey: string
    let updates: Record<string, unknown>

    if (typeof keyOrUpdates === 'string') {
      targetKey = keyOrUpdates
      updates = maybeUpdates!
    } else {
      targetKey = this._abilityKey!
      updates = keyOrUpdates
    }

    const sideData = state[side]
    const baseEntry = sideData.abilities[targetKey]
    const oldLiveEntry = sideData.liveAbilities[targetKey]

    const oldIsEnabled =
      oldLiveEntry && 'isEnabled' in oldLiveEntry
        ? oldLiveEntry.isEnabled
        : baseEntry?.isEnabled
    const oldUses =
      oldLiveEntry && 'uses' in oldLiveEntry
        ? oldLiveEntry.uses
        : baseEntry?.uses

    // COW: shallow-copy the liveAbilities path so mutations don't leak
    // into other branches sharing the same liveAbilities object.
    sideData.liveAbilities = { ...sideData.liveAbilities }
    const liveSideConfig = sideData.liveAbilities
    liveSideConfig[targetKey] = oldLiveEntry ? { ...oldLiveEntry } : {}
    const liveEntry = liveSideConfig[targetKey]

    for (const [key, value] of Object.entries(updates)) {
      if (typeof value === 'function') {
        const currentValue =
          key in liveEntry ? liveEntry[key] : baseEntry?.[key]
        liveEntry[key] = value(currentValue)
      } else {
        liveEntry[key] = value
      }
    }

    const abilitiesParams = this._abilitiesParams
    if (abilitiesParams) {
      const newIsEnabled =
        'isEnabled' in liveEntry ? liveEntry.isEnabled : baseEntry?.isEnabled
      const newUses = 'uses' in liveEntry ? liveEntry.uses : baseEntry?.uses
      if (newIsEnabled !== oldIsEnabled || newUses !== oldUses) {
        if (newIsEnabled === false) {
          abilitiesParams.removeAbilityInvokes(side, targetKey)
        } else {
          abilitiesParams.addAbilityInvokes(side, targetKey, state)
        }
      }

      abilitiesParams.invokeOnParamSet(
        side,
        targetKey,
        Object.keys(updates),
        state,
      )
    }

    // Re-split participating/non-participating only when the update
    // touches a participation-affecting field. Keeps the hot path cheap
    // while catching Alastor / Eidolon / custom priority edits.
    if (
      abilitiesParams &&
      affectsParticipating(targetKey, Object.keys(updates))
    ) {
      abilitiesParams.combatState.resyncParticipating(side)
    }

    // SETTINGS drives `isCategoryMember`, which feeds the resolved-
    // restrictions cache. Drop the side's cache so the next check
    // rebuilds with fresh category membership.
    if (targetKey === 'SETTINGS') {
      sideData._resolvedRestrictions = undefined
    }
  }

  /** Read this side's ephemeral run state for `key` (defaults to the running
   *  ability). Run state lives only for the current `runAbilities` pass and
   *  is discarded when the pass ends — use it for data scoped to a single
   *  timing run (e.g. structures already consumed this pass). Returns
   *  undefined when no pass is active or nothing was written. */
  getRunState(key?: string): Record<string, unknown> | undefined {
    const runState = this._ctx._abilitiesParams._currentRunState
    if (!runState) return undefined
    const targetKey = key ?? this._abilityKey
    if (targetKey === undefined) return undefined
    return runState[this._side][targetKey]
  }

  /** Write ephemeral run state. Same signature as `updateAbilityConfig`
   *  (`updateRunState(updates)` targets the running ability;
   *  `updateRunState(key, updates)` targets `key`). Values may be functions
   *  receiving the previous value. Unlike `updateAbilityConfig`, writes are
   *  not hashed into state identity and are discarded when the current
   *  `runAbilities` pass ends. */
  updateRunState(
    keyOrUpdates: string | Record<string, unknown>,
    maybeUpdates?: Record<string, unknown>,
  ): void {
    const runState = this._ctx._abilitiesParams._currentRunState
    if (!runState) {
      throw new Error('updateRunState called outside an abilities run')
    }

    let targetKey: string
    let updates: Record<string, unknown>
    if (typeof keyOrUpdates === 'string') {
      targetKey = keyOrUpdates
      updates = maybeUpdates!
    } else {
      targetKey = this._abilityKey!
      updates = keyOrUpdates
    }

    const sideRunState = runState[this._side]
    const entry = (sideRunState[targetKey] ??= {})
    for (const [key, value] of Object.entries(updates)) {
      entry[key] = typeof value === 'function' ? value(entry[key]) : value
    }
  }

  /** Apply `+amount` to a side's dice results for this dice-roll group.
   *  `target` selects scope:
   *   - omitted — every variant on the side
   *   - `UnitType` (variant key or base type) — only that variant
   *   - `{ exclude: UnitBaseType[] }` — every variant except those listed
   *   - `{ singleUnit: UnitType }` — exactly one unit of that variant
   *     key (split out of the variant's bucket by matching dpu against
   *     the variant's natural stats; useful for Gravleash-style "1 of
   *     your ship's rolls")
   *
   *  Idempotent per `(abilityKey, target)`: a second call from the
   *  same ability with the same target is silently dropped.
   *
   *  Callable from non-dice-roll timings (e.g. START_OF_COMBAT) — the
   *  declaration is queued onto the pending dice-roll group for the
   *  current meta.
   */
  applyBonusToResult(
    amount: number,
    target?: UnitType | { exclude: UnitBaseType[] } | { singleUnit: UnitType },
  ): void {
    const abilityKey = this._ctx.ability?.key
    if (abilityKey === undefined) {
      throw new Error('applyBonusToResult called outside an ability context')
    }
    const meta = this._ctx.meta
    const groupCtx = findPendingDiceRollGroup(
      this._ctx._abilitiesParams.combatState.pendingSteps,
      meta,
    )
    if (!groupCtx) {
      throw new Error(
        `applyBonusToResult: no pending dice-roll group for meta ${meta}`,
      )
    }
    const list = (groupCtx.modifiers ??= [])
    const unitType =
      target !== undefined && typeof target === 'string' ? target : undefined
    const singleUnit =
      target !== undefined &&
      typeof target === 'object' &&
      'singleUnit' in target
        ? target.singleUnit
        : undefined
    const excludeUnitTypes =
      target !== undefined && typeof target === 'object' && 'exclude' in target
        ? target.exclude
        : undefined
    if (
      list.some(
        m =>
          m.type === 'HIT_VALUE' &&
          m.side === this._side &&
          m.abilityKey === abilityKey &&
          m.unitType === unitType &&
          m.singleUnit === singleUnit &&
          arraysEqual(m.excludeUnitTypes, excludeUnitTypes),
      )
    ) {
      return
    }
    list.push({
      type: 'HIT_VALUE',
      slotId: list.length,
      side: this._side,
      abilityKey,
      amount: -amount,
      unitType,
      singleUnit,
      excludeUnitTypes,
      wasDeclaration: this._ctx.isDeclarationInvoke === true,
    })
  }

  /** Declare "+`count` dice to one unit in the variant with the best
   *  (default / `'BEST'`) or worst (`'WORST'`) hit value." Consumed at
   *  roll time. Only valid during BEFORE_DICE_ROLL / BEFORE_UNIT_ABILITY_ROLL. */
  addDiceCount(count: number, target: 'BEST' | 'WORST' = 'BEST'): void {
    pushModifier(this._ctx, this._side, list => ({
      type: 'ADD_DICE_COUNT',
      slotId: list.length,
      side: this._side,
      abilityKey: this._ctx.ability!.key,
      count,
      target,
    }))
  }

  /** Declare an override of the variant's *base* dice count, preserving any
   *  bonus dice contributed by stats / earlier abilities. Salai Sai Corian's
   *  dynamic flagship dice count uses this. Only valid during
   *  BEFORE_DICE_ROLL / BEFORE_UNIT_ABILITY_ROLL. */
  setDiceCount(count: number, unitType: UnitType): void {
    pushModifier(this._ctx, this._side, list => ({
      type: 'SET_DICE_COUNT',
      slotId: list.length,
      side: this._side,
      abilityKey: this._ctx.ability!.key,
      count,
      unitType,
    }))
  }

  /** Declare an additional dice group keyed under the current ability's key.
   *  Only valid during BEFORE_DICE_ROLL / BEFORE_UNIT_ABILITY_ROLL. The
   *  `diceGroup` is `[hitValue, baseDice, bonusDice?]`; the resulting entry
   *  uses `baseDice + bonusDice` as `dicePerUnit`. */
  addDiceGroup(diceGroup: DiceGroup): void {
    const [hitValue, baseDice, bonusDice = 0] = diceGroup
    const dpu = baseDice + bonusDice
    if (dpu <= 0) return
    pushModifier(this._ctx, this._side, list => ({
      type: 'ADD_DICE_GROUP',
      slotId: list.length,
      side: this._side,
      abilityKey: this._ctx.ability!.key,
      hitValue,
      dpu,
    }))
  }

  /** Queue a roll-trigger declaration on the current dice-roll group.
   *  Consumed by the dice-math kernel inside `_rollDice`. */
  declareRollTrigger(
    spec: Omit<RollTriggerDecl, 'type' | 'slotId' | 'side' | 'abilityKey'>,
  ): void {
    pushModifier(this._ctx, this._side, list => ({
      type: 'ROLL_TRIGGER',
      slotId: list.length,
      side: this._side,
      abilityKey: this._ctx.ability!.key,
      ...spec,
    }))
  }

  /** Queue a conditional hit-value modifier on the current dice-roll group.
   *  The affected side is this SideApi's side (`own` / `opponent`); `uses`
   *  are billed on the ability owner's side. */
  applyConditionalBonusToResult(
    spec: Omit<
      ConditionalModifierDecl,
      'type' | 'slotId' | 'side' | 'ownerSide' | 'abilityKey'
    >,
  ): void {
    const ownerSide = this._ctx.side
    pushModifier(this._ctx, this._side, list => ({
      type: 'CONDITIONAL_MODIFIER',
      slotId: list.length,
      side: this._side,
      ownerSide,
      abilityKey: this._ctx.ability!.key,
      ...spec,
    }))
  }

  /** Queue a reroll declaration on the current dice-roll group. */
  declareReroll(
    spec: Omit<
      RerollDecl,
      'type' | 'slotId' | 'side' | 'ownerSide' | 'abilityKey'
    >,
  ): void {
    const ownerSide = this._ctx.side
    pushModifier(this._ctx, this._side, list => ({
      type: 'REROLL',
      slotId: list.length,
      side: this._side,
      ownerSide,
      abilityKey: this._ctx.ability!.key,
      ...spec,
    }))
  }

  /** Queue a CUSTOM_ROLL declaration on the current dice-roll group.
   *  Replaces the natural per-unit binomial PMF for any dice-collection
   *  entry whose `(hitValue, dpu)` passes `shouldTransform`. */
  declareCustomRoll(
    spec: Omit<CustomRollDecl, 'type' | 'slotId' | 'side' | 'abilityKey'>,
  ): void {
    pushModifier(this._ctx, this._side, list => ({
      type: 'CUSTOM_ROLL',
      slotId: list.length,
      side: this._side,
      abilityKey: this._ctx.ability!.key,
      ...spec,
    }))
  }

  /** Drop the top dice-roll group from the script and clear each side's
   *  `hitPool` — the just-rolled pool (plus anything AFTER_DICE_ROLL
   *  appended on top) is the only thing in there at this point. Earlier
   *  `addHits` calls in the round were already drained inline by
   *  `_assignHits` via the `wasEmpty` path, so there's nothing
   *  pre-existing to preserve. Used by abilities that cancel the current
   *  roll's commit (e.g. Thundarian's restart). */
  discardCurrentGroupScript(): void {
    const cs = this._ctx._abilitiesParams.combatState
    const top = cs.pendingSteps[cs.pendingSteps.length - 1]
    if (top?.kind === 'group') cs.pendingSteps.pop()
    for (const side of ['attacker', 'defender'] as const) {
      const sideData = cs.data[side]
      if (sideData.hitPool === undefined) continue
      sideData.hitPool = undefined
      sideData._hitPoolShared = false
    }
  }

  /** Append script steps to the pending-steps stack. The steps are stored
   *  in execution order — `pushScript` reverses for the LIFO stack. */
  pushSteps(steps: PendingStep[]): void {
    this._ctx._abilitiesParams.combatState.pushScript(steps)
  }
}

// ============================================================================
// ABILITY CONTEXT
// ============================================================================

export class AbilityContext {
  logger?: Logger
  unitSource?: UnitId
  ownerFaction?: FactionKey
  ability?: Ability
  /** True while dispatching an invoke flagged `declaration: true`. Used by
   *  `pushModifier` to tag emitted modifiers so the dice-math kernel can
   *  bill `uses` only when the declaration actually survives. */
  isDeclarationInvoke?: boolean

  _abilitiesParams: AbilitiesEngine
  private _side: CombatSide
  private _api: { own: SideApi; opponent: SideApi }

  constructor(side: CombatSide, abilitiesParams: AbilitiesEngine) {
    this._side = side
    this._abilitiesParams = abilitiesParams
    this._api = {
      own: new SideApi(side, this),
      opponent: new SideApi(getOpponentSide(side), this),
    }
  }

  get state(): CombatStateData {
    return this._abilitiesParams.combatState.data
  }

  /** Innermost active meta-phase for the currently-running ability. Read
   *  straight off the dispatching `PhaseStep` via `combatState.currentStep`.
   *  Used by ability code and SideApi to scope phase-dependent effects (hit-
   *  value modifiers, context filters). Throws when called outside an active
   *  call context (e.g. PREPARE, which has no meta). */
  get meta(): MetaPhase {
    const phase = this.phaseStack
    if (phase && phase.length > 0) return phase[phase.length - 1]
    throw new Error(
      'ctx.meta is not available outside a PhaseStep-dispatched ability call',
    )
  }

  /** Active meta-phase stack (outer→inner) for the currently-running
   *  ability. Exposed for `trigger` / `resolveStep` to propagate. */
  get phaseStack(): MetaPhase[] | undefined {
    return this._abilitiesParams.combatState.currentStep?.phase
  }

  get side(): CombatSide {
    return this._side
  }

  get this(): Ability {
    if (!this.ability) {
      throw new Error('ctx.this is not set — no ability is currently running')
    }
    return this.ability
  }

  get api(): { own: SideApi; opponent: SideApi } {
    return this._api
  }

  get utils(): AbilityUtils {
    return abilityUtils
  }

  get abilities(): OwnOpponentContext<RuntimeAbilityList> {
    const opponent = getOpponentSide(this._side)
    return {
      own: this._abilitiesParams.runtimeAbilityList(this._side),
      opponent: this._abilitiesParams.runtimeAbilityList(opponent),
    }
  }

  /** Phase stack of the current dice-roll group. Reads from the dispatching
   *  step (all steps inside the group share the same `phase` array). Throws
   *  outside a dice-roll group. */
  get currentDiceRollPhase(): MetaPhase[] {
    const cs = this._abilitiesParams.combatState
    if (!isDiceRollContext(cs.currentGroupData)) {
      throw new Error('currentDiceRollPhase called outside a dice-roll group')
    }
    const step = cs.peekStep()
    if (!step) {
      throw new Error('currentDiceRollPhase: dice-roll group has no steps')
    }
    return step.phase
  }

  /** Sides firing in the current dice-roll group. Throws outside one. */
  get currentDiceRollFiring(): CombatSide[] {
    const ctx = this._abilitiesParams.combatState.currentGroupData
    if (!isDiceRollContext(ctx)) {
      throw new Error('currentDiceRollFiring called outside a dice-roll group')
    }
    return ctx.firing
  }

  /** Hit source of the current dice-roll group. Throws outside one. */
  get currentDiceRollHitSource(): HitSource {
    const ctx = this._abilitiesParams.combatState.currentGroupData
    if (!isDiceRollContext(ctx)) {
      throw new Error(
        'currentDiceRollHitSource called outside a dice-roll group',
      )
    }
    return ctx.hitSource
  }

  /** Whether the current dice-roll group is a Proxima-style self-target roll.
   *  Throws outside a dice-roll group. */
  get currentDiceRollSelfTarget(): boolean {
    const ctx = this._abilitiesParams.combatState.currentGroupData
    if (!isDiceRollContext(ctx)) {
      throw new Error(
        'currentDiceRollSelfTarget called outside a dice-roll group',
      )
    }
    return ctx.selfTarget ?? false
  }

  /** Whether the current dice-roll group is a unit-ability roll (vs. a
   *  combat-round roll). Throws outside a dice-roll group. */
  get currentDiceRollIsUnitAbility(): boolean {
    const ctx = this._abilitiesParams.combatState.currentGroupData
    if (!isDiceRollContext(ctx)) {
      throw new Error(
        'currentDiceRollIsUnitAbility called outside a dice-roll group',
      )
    }
    return ctx.isUnitAbility
  }

  getPostRollSides(): { own: RerollSide; opponent: RerollSide } {
    const cs = this._abilitiesParams.combatState
    const ctx = cs.currentGroupData
    if (!isDiceRollContext(ctx) || ctx.hitDistribution === undefined) {
      throw new Error(
        'getPostRollSides called outside a rolled dice-roll group',
      )
    }
    const ownSide = this._side
    const oppSide = getOpponentSide(ownSide)
    const baseHits = (side: CombatSide): number =>
      cs.data[side].hitPool?.base ?? 0
    return {
      own: {
        total: baseHits(oppSide),
        distribution: ctx.hitDistribution[oppSide],
      },
      opponent: {
        total: baseHits(ownSide),
        distribution: ctx.hitDistribution[ownSide],
      },
    }
  }

  /** Side-abstract reroll declaration (docs/dice-math.md §2). `OWN` targets the
   *  side of this AbilityContext; `OPPONENT` targets the other side.
   *  Either slot may be omitted. The ability key is inferred from the
   *  running ability context and shared across both slots — multiple
   *  decls under the same key collapse to a single `uses` decrement
   *  (see `oneShotKeys` in `_rollDice`), which is how War Funding's
   *  own+opponent reroll counts as one charge. */
  declareReroll(spec: {
    OWN?: Omit<RerollTargetSpec, 'key' | 'ownerSide'>
    OPPONENT?: Omit<RerollTargetSpec, 'key' | 'ownerSide'>
  }): void {
    const groupCtx = this._abilitiesParams.combatState.currentGroupData
    if (!isDiceRollContext(groupCtx)) {
      throw new Error('declareReroll called outside a dice-roll group')
    }
    const ability = this.ability
    if (!ability) {
      throw new Error('declareReroll called outside an ability context')
    }
    const key = ability.key
    if (spec.OWN) {
      this._pushReroll(groupCtx, this._side, { ...spec.OWN, key })
    }
    if (spec.OPPONENT) {
      this._pushReroll(groupCtx, getOpponentSide(this._side), {
        ...spec.OPPONENT,
        key,
      })
    }
  }

  /** Side-abstract ADDITIONAL_HIT_POOL (docs/dice-math.md §2). Siphons hits sourced
   *  from `units` on the firing side into an extra pool on the landing
   *  side. `OWN` = this AbilityContext's side as the landing side. */
  declareHitPoolTransform(spec: {
    OWN?: AdditionalHitPoolTargetSpec
    OPPONENT?: AdditionalHitPoolTargetSpec
  }): void {
    const groupCtx = this._abilitiesParams.combatState.currentGroupData
    if (!isDiceRollContext(groupCtx)) {
      throw new Error(
        'declareHitPoolTransform called outside a dice-roll group',
      )
    }
    if (!this.ability) {
      throw new Error(
        'declareHitPoolTransform called outside an ability context',
      )
    }
    if (spec.OWN) this._pushAdditionalHitPool(groupCtx, this._side, spec.OWN)
    if (spec.OPPONENT) {
      this._pushAdditionalHitPool(
        groupCtx,
        getOpponentSide(this._side),
        spec.OPPONENT,
      )
    }
  }

  private _pushReroll(
    groupCtx: DiceRollContext,
    side: CombatSide,
    target: Omit<RerollTargetSpec, 'ownerSide'>,
  ): void {
    const list = (groupCtx.modifiers ??= [])
    list.push({
      type: 'REROLL',
      slotId: list.length,
      side,
      ownerSide: this._side,
      abilityKey: target.key,
      target: target.target,
      rerollIf: target.rerollIf,
      wasDeclaration: this.isDeclarationInvoke === true,
    })
  }

  private _pushAdditionalHitPool(
    groupCtx: DiceRollContext,
    side: CombatSide,
    target: AdditionalHitPoolTargetSpec,
  ): void {
    const list = (groupCtx.modifiers ??= [])
    list.push({
      type: 'ADDITIONAL_HIT_POOL',
      slotId: list.length,
      side,
      abilityKey: target.key,
      units: target.units,
      transform: target.transform,
      wasDeclaration: this.isDeclarationInvoke === true,
    })
  }

  upgradeForCall(ability: Ability, logger?: Logger) {
    this.logger = logger
    this.ability = ability
    this._api.own._abilityKey = ability.key
    this._api.own._abilitiesParams = this._abilitiesParams
    this._api.opponent._abilityKey = ability.key
    this._api.opponent._abilitiesParams = this._abilitiesParams
  }

  resetAfterCall() {
    this.logger = undefined
    this.ability = undefined
    this.isDeclarationInvoke = undefined
    this._api.own._abilityKey = undefined
    this._api.own._abilitiesParams = undefined
    this._api.opponent._abilityKey = undefined
    this._api.opponent._abilitiesParams = undefined
  }

  /** Queue a timing to run as the next script step. The triggered step
   *  inherits this ability's active phase stack (so `context`-scoped
   *  invokes resolve correctly) and runs only after the current `call`
   *  returns: the engine detects the script growth, parks the outer
   *  pass on its dispatching step's `frame` slot, and lets `advance()`
   *  dispatch the pushed step.
   *
   *  Trigger steps pop LIFO, so an ability that needs multiple triggers in
   *  a specific order must push them in reverse of that order.
   *
   *  A provided `context` is stored directly on the step's `data` slot,
   *  where `runAbilities` picks it up. Context-less triggers leave
   *  `data` unset. */
  trigger<T extends AbilityTiming>(
    name: T,
    context?: TimingContextMap[T],
  ): void {
    const combatState = this._abilitiesParams.combatState
    combatState.pendingSteps.push({
      kind: 'timing',
      timing: name,
      phase: this.phaseStack ?? [],
      data: context,
    })
  }

  transitionTo(target: 'COMPLETE', outcome?: 'DRAW' | 'LOST'): void {
    if (target !== 'COMPLETE') {
      throw new Error(`Impossible transition to ${target}`)
    }

    let winner: CombatSide | 'draw' = 'draw' as const
    if (outcome === 'LOST') {
      winner = getOpponentSide(this._side)
    }
    // Drop the current meta's script. Trigger steps pushed after this call
    // survive (they land on the empty stack); to keep any triggers, callers
    // must invoke `transitionTo` before pushing them.
    this._abilitiesParams.combatState._triggerCompletion(
      this.phaseStack!,
      winner,
    )
  }

  runDestroyAbilities(destroyed: UnitId[]): void {
    // Push a PhaseStepGroup carrying the destroyed-units map as shared
    // context. The calling ability is inside a script-driven pass, so
    // `tryResolveOne` parks the outer pass on return (it observes the
    // new pending entry) and `advance()` dispatches the cascade before
    // the outer pass resumes.
    const combatState = this._abilitiesParams.combatState
    combatState.pendingSteps.push(
      buildDestroyGroup(destroyed, this.phaseStack ?? []),
    )
  }

  /** Invoked by `SideApi.addHits` when an ability produces hits out-of-band
   *  (no existing hit pool from the normal dice-roll flow). Delegates to
   *  `combatState.assignHits`, which may throw `AbilityBranchInterrupt` if
   *  the destroy cascade branches. */
  _assignHits(): void {
    this._abilitiesParams.combatState.assignHits(this.phaseStack ?? [])
  }

  getUnit(): UnitId {
    if (this.unitSource === undefined) {
      throw new Error('getUnit() can only be called from unit abilities')
    }
    return this.unitSource
  }

  isOwner(): boolean {
    return (
      this.ownerFaction !== undefined &&
      this.state[this._side].faction === this.ownerFaction
    )
  }

  getAbilitiesForTiming(
    timing: AbilityTiming | AbilityTiming[],
  ): { key: string; name: string }[] {
    return this._abilitiesParams.getAbilityKeysForTiming(this._side, timing)
  }

  /** See AbilityCallContext.rollDice for full docs.
   *  For multi-outcome rolls, throws AbilityBranchInterrupt — the ability
   *  engine's tryResolveOne catches it and handles per-branch post-processing. */
  rollDice(
    dice: DiceGroup[],
    callback: (branchCtx: AbilityContext, hits: number[]) => void,
  ): never {
    const outcomes = getDiceOutcomes(dice)

    // Fast path: single outcome (empty dice, zero counts, or hitValue=1 only)
    // — run callback in place on the outer ctx, no branching.
    if (outcomes.length === 1) {
      callback(this, outcomes[0].hits)
      return undefined as never
    }

    const combatState = this._abilitiesParams.combatState
    const baseData = combatState.data
    const baseInvokes = combatState._invokes
    const baseInvokesOwned = { ...combatState._invokesOwned }
    const baseAllInvokes = combatState._allInvokes
    const baseAllInvokesOwned = combatState._allInvokesOwned
    const baseLogger = this.logger
    // Snapshot outer pending stack so each iteration starts from the same
    // position — otherwise a callback that pushes script state (e.g. a
    // destroy-cascade group via `destroyUnits`) would leak into siblings.
    const basePendingSteps = combatState.pendingSteps
    // Captured when upgradeForCall wired the ctx: the calling ability.
    const ability = this.ability

    const branches: AbilityBranch[] = []

    for (const outcome of outcomes) {
      // COW-arm invokes (same pattern as rollDiceOutcomes in CombatState)
      combatState._invokes = baseInvokes
      combatState._invokesOwned = { attacker: false, defender: false }
      combatState._allInvokes = baseAllInvokes
      combatState._allInvokesOwned = false

      // Fresh per-iteration pending stack. Deep-copies groups so inner
      // steps-arrays aren't shared with the outer stack or other iterations.
      combatState.pendingSteps = clonePendingSteps(basePendingSteps)

      // Clone state for this branch. Phase is derived from the dispatching
      // step on `combatState`, which is shared — branches see the same meta.
      const branchData = cloneStateForBranch(baseData)
      combatState.data = branchData

      // Fork the logger so log entries from branches don't cross-contaminate.
      const branchLogger = baseLogger?.fork()
      branchLogger?.log({ diceHits: outcome.hits })

      // Build a fresh AbilityContext bound to this branch. Inherits the outer
      // ability's identity so updateAbilityConfig / getUnit() still behave
      // as if running under the outer ability.
      const branchCtx = new AbilityContext(this._side, this._abilitiesParams)
      branchCtx.unitSource = this.unitSource
      branchCtx.ownerFaction = this.ownerFaction
      if (ability) branchCtx.upgradeForCall(ability, branchLogger)

      try {
        callback(branchCtx, outcome.hits)
        branches.push({
          data: combatState.data,
          invokes: combatState._invokes,
          allInvokes: combatState._allInvokes,
          probability: outcome.probability,
          logger: branchLogger,
          pendingSteps: combatState.pendingSteps,
        })
      } catch (e) {
        if (!(e instanceof AbilityBranchInterrupt)) throw e
        // Callback branched further (e.g. addHits → assignHits → destroy
        // cascade rolled dice). Flatten nested branches into this loop.
        for (const nested of e.branches) {
          branches.push({
            data: nested.data,
            invokes: nested.invokes,
            allInvokes: nested.allInvokes,
            probability: outcome.probability * nested.probability,
            logger: nested.logger,
            pendingSteps: nested.pendingSteps ?? combatState.pendingSteps,
          })
        }
      } finally {
        branchCtx.resetAfterCall()
      }
    }

    // Restore outer state. tryResolveOne will take over handling via the
    // thrown interrupt — it clones/swaps branches for post-processing.
    combatState._invokes = baseInvokes
    combatState._invokesOwned = baseInvokesOwned
    combatState._allInvokes = baseAllInvokes
    combatState._allInvokesOwned = baseAllInvokesOwned
    combatState.data = baseData
    combatState.pendingSteps = basePendingSteps
    this.logger = baseLogger

    throw new AbilityBranchInterrupt(branches)
  }

  /** See AbilityCallContext.resolveStep for full docs. */
  resolveStep<M extends UnitAbilityMeta>(
    meta: M,
    overrides?: {
      dice?: DiceGroup[]
      target?: 'OWN' | 'OPPONENT'
      firing?: CombatSide[]
      deferCompletionCheck?: boolean
      abilitiesOverride?: AbilitiesOverride
    },
  ): void {
    if (!this.phaseStack) {
      throw new Error(
        'ctx.resolveStep requires an active phase stack (ability must be dispatched from a PhaseStep)',
      )
    }

    const mySide = this._side
    const firing = overrides?.firing ?? [mySide]

    const customDice:
      | { attacker: SideDiceCollection; defender: SideDiceCollection }
      | undefined = overrides?.dice
      ? {
          attacker:
            mySide === 'attacker' ? diceGroupsToCollection(overrides.dice) : {},
          defender:
            mySide === 'defender' ? diceGroupsToCollection(overrides.dice) : {},
        }
      : undefined

    // target='OWN' makes the firing side shoot itself (self-damage). Hits are
    // still produced against the natural opponent, then `_swapHitPools` moves
    // them to the firer after AFTER_UNIT_ABILITY_ROLL.
    const selfTarget = overrides?.target === 'OWN'

    this._abilitiesParams.combatState.runUnitAbility({
      meta,
      firing,
      outerPhase: this.phaseStack,
      customDice,
      selfTarget,
      deferCompletionCheck: overrides?.deferCompletionCheck,
      abilitiesOverride: overrides?.abilitiesOverride,
    })
  }
}

/** Push a declaration into the currently-active dice-roll group's
 *  `modifiers` list. The `build(list)` closure receives the list (so
 *  `slotId = list.length`) and must return the new decl. Throws when
 *  called outside a dice-roll group or outside an ability context. */
function pushModifier(
  ctx: AbilityContext,
  side: CombatSide,
  build: (list: ModifierDecl[]) => ModifierDecl,
): void {
  const groupCtx = ctx._abilitiesParams.combatState.currentGroupData
  if (!isDiceRollContext(groupCtx)) {
    throw new Error('dice-modifier API called outside a dice-roll group')
  }
  if (ctx.ability === undefined) {
    throw new Error('dice-modifier API called outside an ability context')
  }
  // Silence the unused parameter when callers don't use `side` directly —
  // the build closure may still reference it via captured scope.
  void side
  const list = (groupCtx.modifiers ??= [])
  const decl = build(list)
  if (ctx.isDeclarationInvoke) decl.wasDeclaration = true
  list.push(decl)
}

/** Walk the pendingSteps stack tail-first looking for a dice-roll group
 *  whose innermost step targets `meta`. Used by `applyBonusToResult` when
 *  called from a non-dice-roll timing (e.g. START_OF_COMBAT). Returns the
 *  group's `DiceRollContext` (the type guard runs internally). */
function findPendingDiceRollGroup(
  pendingSteps: readonly PendingStep[],
  meta: MetaPhase,
): DiceRollContext | undefined {
  for (let i = pendingSteps.length - 1; i >= 0; i--) {
    const s = pendingSteps[i]
    if (s.kind !== 'group' || !isDiceRollContext(s.data)) continue
    const inner = s.steps[s.steps.length - 1] ?? s.steps[0]
    if (inner && inner.phase[inner.phase.length - 1] === meta) return s.data
  }
  return undefined
}

function arraysEqual<T>(a: T[] | undefined, b: T[] | undefined): boolean {
  if (a === b) return true
  if (!a || !b) return false
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

/** Convert user-provided `DiceGroup[]` (used by `ctx.resolveStep` for
 *  ability dice overrides) into a `SideDiceCollection`. All groups land
 *  under the synthetic `__custom` variant key; entries collapse on
 *  identical `(hitValue, dpu)` pairs. */
function diceGroupsToCollection(
  groups: DiceGroup[] | undefined,
): SideDiceCollection {
  if (!groups || groups.length === 0) return {}
  const list: [number, number, number][] = []
  for (const group of groups) {
    const [hitValue, count] = group
    const bonus = group.length === 3 ? group[2] : 0
    const dpu = count + bonus
    if (dpu <= 0) continue
    const existing = list.find(e => e[1] === hitValue && e[2] === dpu)
    if (existing) existing[0] += 1
    else list.push([1, hitValue, dpu])
  }
  if (list.length === 0) return {}
  return { __custom: list } as SideDiceCollection
}
