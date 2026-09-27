import type { UnitCategory } from '@/constants/units'
import {
  DEFAULT_UNIT_SURFACES,
  UNIT_CATEGORIES,
  UNIT_LIMITS,
  UNIT_TYPES,
} from '@/constants/units'
import type {
  CombatSide,
  SurfaceId,
  UnitAbility,
  UnitBaseType,
  UnitId,
  UnitIdList,
  UnitState,
  UnitStats,
  UnitType,
  UnitLocator,
  UnitVariantId,
} from '@/types'

import { countUnitsByBaseType } from '../abilities-engine/param-limit'
import type {
  AbilitiesOverride,
  DeclaredSubtype,
  ParamFilter,
} from '../abilities-engine/types'
import type {
  CombatMode,
  CombatStateData,
  HitPool,
  HitSource,
  MetaPhase,
  ResolvedRestrictions,
  ResolvedRestrictionsLayer,
  RestrictionEntry,
  SideAbilitiesConfig,
  SideStateData,
  UnitAbilityMeta,
  UnitAbilityRestrictions,
} from '../combat-state/types'
import type {
  HitValueModifierDecl,
  SideDiceCollection,
} from '../dice-math/types'
import { canonicalizeUnitState } from '../utils/canonicalize-unit-state'
import { parseUnitLocator } from '../utils/parse-unit-locator'
import { resolveUnitStats } from '../utils/resolve-unit-stats'
import {
  isNativeCategory,
  isUnitCategory,
  isUnitAbilityTarget,
  participatesNatively,
  unitMetaHash,
} from '../utils/unit-combat-properties'
import { nextUnitIds } from '../utils/unit-id'
import { matchesUnitLocator, unitLocatorMatcher } from '../utils/unit-locator'
import { makeVariantId } from '../utils/unit-variant'

/** Shared empty destroyed record to avoid per-call {} allocation */
const EMPTY_DESTROYED: Record<string, UnitId[]> = {}

/** Pre-filter declared subtypes by `excludeSubtypeSource` and
 *  `includeNonParticipating`. Shared between runtime variant queries
 *  (`getUnitVariants`) and reconcile (consumer-param valid-list build). */
export function filterDeclaredSubtypes(
  allSubtypes: readonly DeclaredSubtype[],
  filter?: Pick<
    ParamFilter,
    'excludeSubtypeSource' | 'includeNonParticipating'
  >,
): DeclaredSubtype[] {
  const excludedSources = filter?.excludeSubtypeSource
    ? new Set<string>(filter.excludeSubtypeSource)
    : undefined
  let result = excludedSources
    ? allSubtypes.filter(
        d => d.source === undefined || !excludedSources.has(d.source),
      )
    : [...allSubtypes]
  if (!filter?.includeNonParticipating) {
    result = result.filter(d => d.participating !== false)
  }
  return result
}

/** Apply the post-expansion variant filters
 *  (`include`, `exclude`, `excludeSubtypes`, `includeSubtypes`).
 *  Pure on the variant list; shared between `getUnitVariants` and reconcile. */
export function applyVariantPostFilter(
  variants: readonly string[],
  filter?: Pick<
    ParamFilter,
    'include' | 'exclude' | 'excludeSubtypes' | 'includeSubtypes'
  >,
): string[] {
  if (!filter) return [...variants]
  const includeParsed = filter.include?.map(v => parseUnitLocator(v))
  const excludeParsed = filter.exclude?.map(v => parseUnitLocator(v))
  const excludeSubtypeSet = filter.excludeSubtypes
    ? new Set<string>(filter.excludeSubtypes)
    : undefined
  const includeSubtypeSet =
    filter.includeSubtypes && filter.includeSubtypes.length > 0
      ? new Set<string>(filter.includeSubtypes)
      : undefined
  const matches = (
    variantParsed: { baseType: UnitBaseType; subtypes: UnitVariantId[] },
    entry: { baseType: UnitBaseType; subtypes: UnitVariantId[] },
  ) => {
    if (variantParsed.baseType !== entry.baseType) return false
    if (entry.subtypes.length === 0) return true
    const vSubs = new Set<string>(variantParsed.subtypes)
    return entry.subtypes.every(s => vSubs.has(s))
  }

  let filtered: string[] = [...variants]
  if (includeParsed && includeParsed.length > 0) {
    filtered = filtered.filter(v => {
      const p = parseUnitLocator(v as UnitType)
      return includeParsed.some(e => matches(p, e))
    })
  }
  if (excludeParsed && excludeParsed.length > 0) {
    filtered = filtered.filter(v => {
      const p = parseUnitLocator(v as UnitType)
      return !excludeParsed.some(e => matches(p, e))
    })
  }
  if (excludeSubtypeSet) {
    filtered = filtered.filter(v => {
      const { subtypes } = parseUnitLocator(v as UnitType)
      return !subtypes.some(sub => excludeSubtypeSet.has(sub))
    })
  }
  if (includeSubtypeSet) {
    filtered = filtered.filter(v => {
      const { subtypes } = parseUnitLocator(v as UnitType)
      return subtypes.some(sub => includeSubtypeSet.has(sub))
    })
  }
  return filtered
}

/** Parse a UnitList (flat or `[type, enabled]` tuples) into a UnitType[]. */
function parsePriorityList(raw: unknown): UnitLocator[] | undefined {
  if (!Array.isArray(raw)) return undefined
  if (raw.length === 0) return raw as UnitLocator[]
  if (!Array.isArray(raw[0])) return raw as UnitLocator[]
  const result: UnitLocator[] = []
  for (const entry of raw as readonly [string, ...unknown[]][]) {
    if (entry.length >= 2 && entry[1] === false) continue
    result.push(entry[0] as UnitLocator)
  }
  return result
}

/** CoW — clone `unitState` if its ref may be shared with another side.
 *  Also clones the touched entry refs lazily via replace-semantics at
 *  the mutation site (see `modifyUnitState`). */
function ensureUnitStateOwned(s: SideStateData): void {
  if (s._unitStateShared) {
    s.unitState = { ...s.unitState }
    s._unitStateShared = false
  }
}

/** CoW — clone `hitPool` if its ref may be shared with another side.
 *  The `custom` array is also shallow-cloned in the same step since
 *  mutations that touch custom entries (append, remove, merge into main)
 *  need a side-local array. Caller must guard against `hitPool === undefined`. */
function ensureHitPoolOwned(s: SideStateData): void {
  if (s._hitPoolShared && s.hitPool !== undefined) {
    s.hitPool = { ...s.hitPool, custom: s.hitPool.custom.slice() }
    s._hitPoolShared = false
  }
}

/** Get the side's hit pool, creating it (empty) if absent. Also clones
 *  the existing pool when shared. Returns the now-owned pool. */
function ensureHitPool(s: SideStateData): HitPool {
  if (s.hitPool === undefined) {
    s.hitPool = { base: 0, additional: 0, custom: [] }
    s._hitPoolShared = false
    return s.hitPool
  }
  ensureHitPoolOwned(s)
  return s.hitPool!
}

const liveAbilitiesSideHashCache = new WeakMap<SideAbilitiesConfig, string>()

function computeLiveAbilitiesHash(side: SideAbilitiesConfig): string {
  const cached = liveAbilitiesSideHashCache.get(side)
  if (cached !== undefined) return cached
  const keys = Object.keys(side).sort()
  const result =
    keys.length === 0
      ? ''
      : keys.map(k => `${k}:${JSON.stringify(side[k])}`).join(',')
  liveAbilitiesSideHashCache.set(side, result)
  return result
}

/** Tail-slice picker for unrestricted main-pool hits. Highest-priority
 *  units sit at index 0; tail units are sacrificed first. */
function pickTailTargets(
  pool: UnitIdList | readonly UnitId[],
  total: number,
): UnitId[] {
  if (total <= 0 || pool.length === 0) return []
  const take = Math.min(total, pool.length)
  const result: UnitId[] = []
  for (let i = pool.length - take; i < pool.length; i++) {
    result.push(pool[i] as UnitId)
  }
  return result
}

/** Pick destruction targets for a custom sub-pool. Walks the entry's
 *  `unitPriority` as a tier list — earlier entries preferred, later
 *  as fallback. Each entry may be a variant key (exact match) or a
 *  base type (matches every variant of that base type). Within each
 *  tier, walks the pool tail-first. */
function pickTargetsForCustom(
  s: SideStateData,
  pool: UnitIdList | readonly UnitId[],
  total: number,
  unitPriority: readonly UnitLocator[],
  targets?: readonly UnitLocator[],
): UnitId[] {
  if (total <= 0 || pool.length === 0) return []
  const result: UnitId[] = []
  if (unitPriority.length === 0 && targets) {
    for (let i = pool.length - 1; i >= 0 && result.length < total; i--) {
      const id = pool[i] as UnitId
      if (isUnitAbilityTarget(s, id, targets)) result.push(id)
    }
    return result
  }
  for (const tier of unitPriority) {
    if (result.length >= total) break
    const matches = unitLocatorMatcher(
      s,
      tier,
      !parseUnitLocator(tier).unitType.includes(':'),
    )
    for (let i = pool.length - 1; i >= 0 && result.length < total; i--) {
      const id = pool[i] as UnitId
      if (result.includes(id) || !isUnitAbilityTarget(s, id, targets)) continue
      if (matches(id)) result.push(id)
    }
  }
  return result
}

/** True when a unit's variant key resolves to the FIGHTER base type. */
function isFighterVariant(variantKey: UnitType | undefined): boolean {
  if (variantKey === undefined) return false
  if (variantKey === 'FIGHTER') return true
  // Variant keys are `BASE` or `BASE:subtype`, so a startsWith check on
  // `FIGHTER:` is equivalent to (and cheaper than) parseUnitLocator.
  return (
    variantKey.length > 7 &&
    variantKey.charCodeAt(7) === 58 /* ':' */ &&
    variantKey.startsWith('FIGHTER:')
  )
}

/** Checks the `[0.0.1]`-style pattern: `unitPriority` contains at least one
 *  FIGHTER tier and one non-FIGHTER tier, with every non-FIGHTER tier
 *  strictly before every FIGHTER tier. Returns the single surface its
 *  qualified tiers name (`null` when none are qualified), or `false` when
 *  the pattern fails or the tiers name several surfaces. Necessary but not
 *  sufficient for the assignHits fast path — the caller must also verify
 *  that every non-FIGHTER unit in the receiving pool has a base type
 *  covered by `unitPriority` (otherwise selective priorities like
 *  `[CRUISER, FIGHTER]` would over-pick into types that aren't actually
 *  in the tier list) and that every unit sits on the returned surface.
 *  Hot path — cached per unitPriority array. */
const fighterAtBottomCache = new WeakMap<
  readonly UnitLocator[],
  SurfaceId | null | false
>()
function fighterAtBottomSurface(
  unitPriority: readonly UnitLocator[],
): SurfaceId | null | false {
  const cached = fighterAtBottomCache.get(unitPriority)
  if (cached !== undefined) return cached
  let seenFighter = false
  let seenNonFighter = false
  let result: SurfaceId | null | false = null
  for (const target of unitPriority) {
    const { baseType, surfaceId } = parseUnitLocator(target)
    if (surfaceId !== undefined) {
      if (result !== null && result !== surfaceId) {
        result = false
        break
      }
      result = surfaceId
    }
    if (baseType === 'FIGHTER') {
      seenFighter = true
    } else if (seenFighter) {
      result = false
      break
    } else {
      seenNonFighter = true
    }
  }
  if (!seenFighter || !seenNonFighter) result = false
  fighterAtBottomCache.set(unitPriority, result)
  return result
}

/** Verify the custom entry's non-FIGHTER tiers exactly match the pool's
 *  tail-to-head non-FIGHTER base-type sequence. This is the strict
 *  invariant required for the single-pass fast path to be equivalent to
 *  `pickTargetsForCustom`:
 *
 *  - The custom entry walks `unitPriority` head-first; for each tier it
 *    walks the pool tail-first. The destroyed set therefore visits
 *    distinct base types in the order they appear in `unitPriority`,
 *    and within a single base type in pool-tail order.
 *  - The fast path walks the pool tail-to-head and destroys every
 *    non-fighter it encounters until `customRemaining` is exhausted. It
 *    can ONLY produce the same destroyed set when each non-fighter base
 *    type, read tail-to-head, appears in the same order as in
 *    `unitPriority`'s non-FIGHTER prefix. For [0.0.1] this holds because
 *    its `unitPriority` is the opponent's default spaceUnitPriority
 *    (cheapest first) with FIGHTER moved to the end, and the opposing
 *    participating pool is itself sorted cheapest-at-tail. For SCO with
 *    a `customPriority` that reorders the non-fighter tiers, the
 *    check correctly rejects the fast path. */
function poolTailNonFightersFollowPriority(
  s: SideStateData,
  pool: UnitIdList | readonly UnitId[],
  unitPriority: readonly UnitLocator[],
  surfaceId: SurfaceId | null,
): boolean {
  let priIdx = 0
  const seenPool = new Set<string>()
  for (let i = pool.length - 1; i >= 0; i--) {
    const id = pool[i] as UnitId
    // Qualified tiers act like base-type tiers only on their own surface.
    if (surfaceId !== null && s.unitSurface[id] !== surfaceId) return false
    const variant = s.unitType[id]
    if (variant === undefined) continue
    if (isFighterVariant(variant)) continue
    const base = parseUnitLocator(variant).baseType as string
    if (seenPool.has(base)) continue
    seenPool.add(base)
    // Advance priIdx until we find this base in unitPriority, skipping
    // tiers that don't appear in the pool. Stop at FIGHTER or end.
    let matched = false
    while (priIdx < unitPriority.length) {
      const pt = unitPriority[priIdx]
      const pBase = parseUnitLocator(pt).baseType as string
      if (pBase === 'FIGHTER') break
      priIdx++
      if (pBase === base) {
        matched = true
        break
      }
    }
    if (!matched) return false
  }
  return true
}

/** Gate for the assignHits `[0.0.1]` single-pass fast path. */
function fitsFighterFastPath(
  s: SideStateData,
  pool: NonNullable<SideStateData['hitPool']>,
  units: UnitIdList,
): boolean {
  if (pool.custom.length !== 1 || pool.unitAbilityTargets) return false
  const { unitPriority } = pool.custom[0]
  const surfaceId = fighterAtBottomSurface(unitPriority)
  return (
    surfaceId !== false &&
    poolTailNonFightersFollowPriority(s, units, unitPriority, surfaceId)
  )
}

/** Check if the ability that sourced a restriction is itself disabled.
 *  Looks across both combat sides, both layers. Visited set prevents cycles. */
function isSourceDisabled(
  state: CombatStateData,
  reason: string,
  visited: Set<string>,
): boolean {
  if (visited.has(reason)) return false
  visited.add(reason)

  const ability = reason as UnitAbility
  for (const side of ['attacker', 'defender'] as const) {
    const restrictions = state[side].unitAbilityRestrictions
    if (!restrictions) continue

    for (const layer of ['lost', 'cannotBeUsed'] as const) {
      const entries = restrictions[layer]?.[ability]
      if (!entries || entries.length === 0) continue

      // A surface-scoped entry disables its ability only on that surface,
      // never the ability as a restriction source.
      const hasValidEntry = entries.some(
        e => !e.surfaceId && !isSourceDisabled(state, e.reason, visited),
      )
      if (hasValidEntry) return true
    }
  }
  return false
}

/** Shared empty resolved cache used when a side has no restrictions. */
const EMPTY_RESOLVED: ResolvedRestrictions = {
  cannotBeUsed: new Map(),
  lost: new Map(),
}

/** Invalidate the resolved-restrictions cache on both sides. Cheap —
 *  just drops the refs. Cache is rebuilt lazily on the next `isRestricted`
 *  / `isAbilityBlocked` read. Must be called from any mutation that could
 *  affect a restriction outcome: raw entry add/remove (this side or the
 *  other, because cascades cross sides), unit composition changes (new
 *  variant keys), native stats, and per-unit changes. */
function invalidateResolvedRestrictions(state: CombatStateData): void {
  state.attacker._resolvedRestrictions = undefined
  state.defender._resolvedRestrictions = undefined
}

/** Build the resolved-restrictions cache for one side. Runs the cascade
 *  check (`isSourceDisabled`) once per raw entry, expands base-type and
 *  category rules
 *  rules against the side's current variant keys, and caches a
 *  `Set<UnitType | UnitId> | 'ALL'` per (layer, ability). Subsequent checks are
 *  Map.get + Set.has — O(1). */
function buildResolvedForSide(
  state: CombatStateData,
  side: CombatSide,
): ResolvedRestrictions {
  const s = state[side]
  const phase = state.meta
  const raw = s.unitAbilityRestrictions
  if (!raw) return EMPTY_RESOLVED

  const cannotBeUsed: ResolvedRestrictionsLayer = new Map()
  const lost: ResolvedRestrictionsLayer = new Map()

  // Unique variant keys currently on the side, needed to expand
  // base-type rules into concrete variant matches.
  const variantKeys = new Set<UnitType>(Object.values(s.unitType))
  const unitIds = Object.keys(s.unitType)

  // reason -> unit base types that ignore restrictions from that source.
  const immuneByReason = new Map<string, Set<UnitBaseType>>()
  for (const { reason, unitType } of raw.immune ?? []) {
    const set = immuneByReason.get(reason) ?? new Set<UnitBaseType>()
    set.add(unitType)
    immuneByReason.set(reason, set)
  }

  const addToLayer = (
    target: ResolvedRestrictionsLayer,
    ability: UnitAbility,
    entry: RestrictionEntry,
  ) => {
    const existing = target.get(ability)
    if (existing === 'ALL') return

    const { unitType, category, surfaceId } = entry
    const immune = immuneByReason.get(entry.reason)
    const isImmune = (baseType: string) =>
      immune !== undefined && immune.has(baseType as UnitBaseType)

    // A blanket entry with an immune unit type on the side is expanded into
    // the concrete types present instead of 'ALL', minus the immune ones.
    if (!unitType && !category && !immune && !surfaceId) {
      target.set(ability, 'ALL')
      return
    }
    const set = existing ?? new Set<UnitType | UnitId>()
    target.set(ability, set)

    // A surface-scoped entry restricts only the units standing on that
    // surface, so it resolves to ids alone (`moveUnits` invalidates).
    if (!surfaceId) {
      // A bare baseType entry also restricts every variant of that type.
      if (unitType && !isImmune(unitType)) set.add(unitType as UnitType)
      for (const key of variantKeys) {
        const baseType = parseUnitLocator(key).baseType
        if (isImmune(baseType)) continue
        if (
          unitType
            ? baseType === unitType
            : !category || isNativeCategory(s, key, category, phase)
        ) {
          set.add(key)
          set.add(baseType as UnitType)
        }
      }
    }

    for (const id of unitIds) {
      if (surfaceId && s.unitSurface[id] !== surfaceId) continue
      const baseType = parseUnitLocator(s.unitType[id]).baseType
      if (isImmune(baseType)) continue
      if (
        unitType
          ? baseType === unitType
          : !category || isUnitCategory(s, id, category, phase)
      ) {
        set.add(id as UnitId)
      }
    }
  }

  for (const layer of ['lost', 'cannotBeUsed'] as const) {
    const layerData = raw[layer]
    if (!layerData) continue
    const target = layer === 'lost' ? lost : cannotBeUsed
    for (const ability in layerData) {
      const entries = layerData[ability as UnitAbility]
      if (!entries) continue
      for (const entry of entries) {
        if (isSourceDisabled(state, entry.reason, new Set())) continue
        addToLayer(target, ability as UnitAbility, entry)
      }
    }
  }

  return { cannotBeUsed, lost }
}

/** `unitState` segment of the state hash: one id char and one damage flag
 *  per entry, ordered by id. Entries are few, so an inline insertion sort
 *  beats `Array#sort`. */
function unitStateHash(s: SideStateData): string {
  const ids: string[] = []
  for (const id in s.unitState) {
    let i = ids.length - 1
    while (i >= 0 && ids[i] > id) {
      ids[i + 1] = ids[i]
      i--
    }
    ids[i + 1] = id
  }
  let body = ''
  for (const id of ids) body += s.unitState[id].isDamaged ? `${id}1` : `${id}0`
  return body
}

/** Lazy accessor — returns the per-side resolved cache, building it on
 *  first read after invalidation. */
function getResolvedRestrictions(
  state: CombatStateData,
  side: CombatSide,
): ResolvedRestrictions {
  const cached = state[side]._resolvedRestrictions
  if (cached) return cached
  const built = buildResolvedForSide(state, side)
  state[side]._resolvedRestrictions = built
  return built
}

function _removeOne(s: SideStateData, unitId: UnitId): void {
  const pIdx = s.participatingUnits.indexOf(unitId)
  if (pIdx !== -1) {
    s.participatingUnits = (s.participatingUnits.slice(0, pIdx) +
      s.participatingUnits.slice(pIdx + 1)) as UnitIdList
  } else {
    const nIdx = s.nonParticipatingUnits.indexOf(unitId)
    if (nIdx === -1) return
    s.nonParticipatingUnits = (s.nonParticipatingUnits.slice(0, nIdx) +
      s.nonParticipatingUnits.slice(nIdx + 1)) as UnitIdList
  }
}

function addRestrictionEntry(
  restrictions: UnitAbilityRestrictions | undefined,
  layer: 'lost' | 'cannotBeUsed',
  ability: UnitAbility,
  reason: string,
  unitType?: UnitBaseType,
  category?: UnitCategory,
  surfaceId?: SurfaceId,
): UnitAbilityRestrictions {
  const current = restrictions ?? {}
  const layerData = current[layer] ?? {}
  const entries = layerData[ability] ?? []
  if (
    entries.some(
      entry =>
        entry.reason === reason &&
        entry.unitType === unitType &&
        entry.category === category &&
        entry.surfaceId === surfaceId,
    )
  ) {
    return current
  }
  const entry: RestrictionEntry = { reason }
  if (unitType) entry.unitType = unitType
  if (category) entry.category = category
  if (surfaceId) entry.surfaceId = surfaceId

  return {
    ...current,
    [layer]: {
      ...layerData,
      [ability]: [...entries, entry],
    },
  }
}

function removeRestrictionEntry(
  restrictions: UnitAbilityRestrictions | undefined,
  layer: 'lost' | 'cannotBeUsed',
  ability: UnitAbility,
  reason: string,
  unitType?: UnitBaseType,
  category?: UnitCategory,
  surfaceId?: SurfaceId,
): UnitAbilityRestrictions | undefined {
  if (!restrictions) return undefined
  const layerData = restrictions[layer]
  if (!layerData) return restrictions
  const entries = layerData[ability]
  if (!entries) return restrictions

  const filtered = entries.filter(
    e =>
      e.reason !== reason ||
      e.unitType !== unitType ||
      e.category !== category ||
      e.surfaceId !== surfaceId,
  )

  const newLayerData = { ...layerData }
  if (filtered.length > 0) {
    newLayerData[ability] = filtered
  } else {
    delete newLayerData[ability]
  }

  const hasEntries = Object.keys(newLayerData).length > 0
  const result = {
    ...restrictions,
    [layer]: hasEntries ? newLayerData : undefined,
  }

  if (!result.lost && !result.cannotBeUsed && !result.immune) return undefined
  return result
}

function addImmunityEntry(
  restrictions: UnitAbilityRestrictions | undefined,
  reason: string,
  unitType: UnitBaseType,
): UnitAbilityRestrictions {
  const current = restrictions ?? {}
  const entries = current.immune ?? []
  if (entries.some(e => e.reason === reason && e.unitType === unitType)) {
    return current
  }
  return { ...current, immune: [...entries, { reason, unitType }] }
}

function removeImmunityEntry(
  restrictions: UnitAbilityRestrictions | undefined,
  reason: string,
  unitType: UnitBaseType,
): UnitAbilityRestrictions | undefined {
  if (!restrictions?.immune) return restrictions
  const filtered = restrictions.immune.filter(
    e => e.reason !== reason || e.unitType !== unitType,
  )
  const result = {
    ...restrictions,
    immune: filtered.length > 0 ? filtered : undefined,
  }
  if (!result.lost && !result.cannotBeUsed && !result.immune) return undefined
  return result
}

export interface GetUnitsOptions {
  includeVariants?: boolean
  participatingOnly?: boolean
  surfaceId?: SurfaceId
}

/** Predicate to further restrict candidates in `findUnitByPriority`.
 *  Receives the unit's own variant key and its UnitId. */
export type FindUnitPredicate = (variantKey: UnitType, id: UnitId) => boolean

/**
 * CombatSideState — namespace of all side operations.
 *
 * Every method is static and takes raw data as its first argument
 * (`SideStateData`, or `CombatStateData + side` when cross-side access is
 * needed). The class never allocates; it's purely a namespace so hot paths
 * like dice-outcome branching and hit assignment stay allocation-free.
 */
export class CombatSideState {
  // ==========================================================================
  // OPPONENT
  // ==========================================================================

  static getOpponentSide(side: CombatSide): CombatSide {
    return side === 'attacker' ? 'defender' : 'attacker'
  }

  // ==========================================================================
  // HASHING
  // ==========================================================================

  /** Hash this side's units (participating, non-participating, and
   *  per-unit mutable state) for state deduplication.
   *
   *  Layout: `participating!nonParticipating|state[location][categories]`.
   *  `state` is one id char plus a `1`/`0` damage flag per `unitState`
   *  entry, ordered by id, so the same entries hash identically regardless
   *  of which ability touched each unit first. Entries of destroyed units
   *  are kept, and an entry without damage still differs from no entry.
   *  UnitIds sit above ASCII, so the ASCII markers of the optional
   *  `@location` and `#categories` segments (`unitMetaHash`) cannot be
   *  mistaken for state.
   *
   *  Convergence across equivalent states ("A damaged" vs "B damaged")
   *  relies on `canonicalizeUnitState` having run. Natural sustain
   *  order keeps the bijection (lowest pool-ID ↔ worst state) stable;
   *  Duranium's WHEN_SUSTAIN and AFTER_ASSIGN repair both call
   *  `SideApi.resortUnits()` to mark `_needsCanonicalize`. The flush
   *  here catches state read at round-start (cache-key time), where
   *  the BEFORE_ASSIGN_HITS script step hasn't run yet. */
  static getUnitsHash(s: SideStateData, activeSurfaceId: SurfaceId): string {
    const dirty = s._needsCanonicalize
    if (dirty) {
      canonicalizeUnitState(s, dirty)
    }
    return `${s.participatingUnits}!${s.nonParticipatingUnits}|${unitStateHash(s)}${unitMetaHash(s, activeSurfaceId)}`
  }

  /** Hash this side's `liveAbilities`. The initial `abilities` config is
   *  fixed for the whole combat so it never differentiates states; only
   *  runtime mutations (isEnabled, uses, ability-specific fields) matter
   *  for state identity. */
  static getAbilitiesHash(s: SideStateData): string {
    return computeLiveAbilitiesHash(s.liveAbilities)
  }

  /** Full identity hash for this side — units + runtime ability overlay. */
  static getHash(s: SideStateData, activeSurfaceId: SurfaceId): string {
    return `${CombatSideState.getUnitsHash(s, activeSurfaceId)}+${CombatSideState.getAbilitiesHash(s)}`
  }

  // ==========================================================================
  // PRESENCE CHECKS
  // ==========================================================================

  /** True if the side still holds any participating unit. */
  static hasParticipatingUnits(s: SideStateData): boolean {
    return s.participatingUnits.length > 0
  }

  /** Check if a specific UnitId is alive on this side. */
  static hasUnit(s: SideStateData, unitId: UnitId): boolean {
    return (
      s.participatingUnits.includes(unitId) ||
      s.nonParticipatingUnits.includes(unitId)
    )
  }

  /** Check if a unit type has any alive units. */
  static hasUnitType(
    s: SideStateData,
    unitType: UnitLocator,
    options?: GetUnitsOptions,
  ): boolean {
    return CombatSideState.countUnits(s, unitType, options) > 0
  }

  // ==========================================================================
  // UNIT LOOKUP
  // ==========================================================================

  /** Find variant key for a UnitId (empty string if not tracked). */
  static findVariantKey(s: SideStateData, unitId: UnitId): UnitType | '' {
    return s.unitType[unitId] ?? ''
  }

  /** Get all UnitIds for a type, optionally including variants.
   *  Participating ids are returned first (in priority-sort order). */
  static getUnits(
    s: SideStateData,
    unitType: UnitLocator | undefined,
    options?: GetUnitsOptions,
  ): UnitId[] {
    const result: UnitId[] = []
    const matches =
      unitType === undefined
        ? () => true
        : unitLocatorMatcher(s, unitType, options?.includeVariants)
    const surfaceId = options?.surfaceId
    for (const id of s.participatingUnits) {
      if ((!surfaceId || s.unitSurface[id] === surfaceId) && matches(id))
        result.push(id as UnitId)
    }
    if (options?.participatingOnly) return result
    for (const id of s.nonParticipatingUnits) {
      if ((!surfaceId || s.unitSurface[id] === surfaceId) && matches(id))
        result.push(id as UnitId)
    }
    return result
  }

  /** Count units with optional filter and variant support.
   *  Counts across both participating and non-participating pools. */
  static countUnits(
    s: SideStateData,
    filter?: UnitLocator | UnitLocator[],
    options?: GetUnitsOptions,
  ): number {
    if (!filter) return CombatSideState.getUnits(s, undefined, options).length
    const filters = typeof filter === 'string' ? [filter] : filter
    let total = 0
    for (const f of filters) {
      total += CombatSideState.getUnits(s, f, options).length
    }
    return total
  }

  static findUnitByPriority(
    s: SideStateData,
    priority: UnitLocator[],
    options: GetUnitsOptions & { predicate?: FindUnitPredicate },
  ): UnitId | undefined
  static findUnitByPriority(
    s: SideStateData,
    priority: UnitLocator[],
    options: GetUnitsOptions & {
      amount: number
      predicate?: FindUnitPredicate
    },
  ): UnitId[]
  static findUnitByPriority(
    s: SideStateData,
    priority: UnitLocator[],
    options: GetUnitsOptions & {
      amount?: number
      predicate?: FindUnitPredicate
    },
  ): UnitId | UnitId[] | undefined {
    const collect = options.amount !== undefined
    const amount = options.amount ?? Infinity
    const { predicate } = options
    const result: UnitId[] = []

    for (const variantId of priority) {
      for (const id of CombatSideState.getUnits(s, variantId, options)) {
        if (predicate && !predicate(s.unitType[id], id)) continue
        if (!collect) return id
        result.push(id)
        if (result.length >= amount) return result
      }
    }
    return collect ? result : undefined
  }

  /** Get UnitState for a UnitId. */
  static getUnitState(s: SideStateData, unitId: UnitId): UnitState | undefined {
    return s.unitState[unitId] ?? {}
  }

  /** Grant `category` to the living `ids` (see `SideStateData.unitGrants`). */
  static grantCategory(
    s: SideStateData,
    ids: readonly UnitId[],
    category: UnitCategory,
  ): void {
    let next: Record<string, UnitCategory> | undefined
    for (const id of ids) {
      if (!CombatSideState.hasUnit(s, id) || s.unitGrants?.[id] === category)
        continue
      next ??= { ...s.unitGrants }
      next[id] = category
    }
    if (!next) return
    s.unitGrants = next
    s._resolvedRestrictions = undefined
  }

  static canAssignHitToUnit(s: SideStateData, id: UnitId): boolean {
    const pool = s.hitPool
    if (!pool) return true
    if (!isUnitAbilityTarget(s, id, pool.unitAbilityTargets)) return false
    if (pool.base + pool.additional > 0) return true
    return pool.custom.some(
      entry =>
        entry.base > 0 &&
        (entry.unitPriority.length === 0 ||
          entry.unitPriority.some(type =>
            matchesUnitLocator(s, id, type, true),
          )),
    )
  }

  /** Get base type for a UnitId. */
  static getUnitBaseType(
    s: SideStateData,
    unitId: UnitId,
  ): UnitBaseType | undefined {
    const key = s.unitType[unitId]
    if (!key) return undefined
    return parseUnitLocator(key).baseType as UnitBaseType
  }

  /** Get all active base types (types with at least one alive unit). */
  static getActiveBaseTypes(
    s: SideStateData,
    options?: GetUnitsOptions,
  ): UnitBaseType[] {
    const types = new Set<UnitBaseType>()
    for (const id of CombatSideState.getUnits(s, undefined, options))
      types.add(parseUnitLocator(s.unitType[id]).baseType as UnitBaseType)
    return [...types]
  }

  // ==========================================================================
  // HIT POOL HELPERS
  // ==========================================================================

  /** Sum currently-staged hits. Without a filter returns base + additional
   *  (across main pool and all custom entries). The `base` slot counts
   *  main.base plus every custom entry's base; `bonus` counts
   *  main.additional only (custom entries have no `additional` slot). */
  static getPendingHits(
    s: SideStateData,
    filter?: { base?: true; bonus?: true },
  ): number {
    if (s.hitPool === undefined) return 0
    const b = !filter || filter.base
    const n = !filter || filter.bonus
    let sum = 0
    if (b) {
      sum += s.hitPool.base
      for (const c of s.hitPool.custom) sum += c.base
    }
    if (n) sum += s.hitPool.additional
    return sum
  }

  // ==========================================================================
  // STATS
  // ==========================================================================

  /** Resolve unit stats for a variant key */
  static resolveUnitStats(
    s: SideStateData,
    key: UnitType,
  ): UnitStats | undefined {
    return resolveUnitStats(s.unitStats, key)
  }

  /** Get unit stats by variant key or UnitId */
  static getUnitStats(
    s: SideStateData,
    unitTypeOrId: string | UnitId,
  ): UnitStats | undefined {
    // UnitId is a single-char packed token; any longer string is a variant key.
    if (unitTypeOrId.length > 1) {
      const stats = resolveUnitStats(s.unitStats, unitTypeOrId as UnitType)
      if (stats) return stats
      const { baseType: type } = parseUnitLocator(unitTypeOrId as UnitType)
      if (type !== unitTypeOrId) {
        return resolveUnitStats(s.unitStats, type)
      }
      return undefined
    }
    const key = CombatSideState.findVariantKey(s, unitTypeOrId as UnitId)
    if (!key) return undefined
    return resolveUnitStats(s.unitStats, key)
  }

  // ==========================================================================
  // LIVE PARAMS
  // ==========================================================================

  /** Merge base ability config with any live overlay for this side. */
  static getLiveParams(
    s: SideStateData,
    abilityKey: string,
  ): Record<string, unknown> | undefined {
    const live = s.liveAbilities[abilityKey]
    if (live === undefined) return s.abilities[abilityKey]
    const base = s.abilities[abilityKey]
    if (base === undefined) return live
    return { ...base, ...live }
  }

  /** Types that can be `source` during `phase` (option lists pass their
   *  mode's combat meta). */
  static getCategoryOptionTypes(
    s: SideStateData,
    source: UnitCategory | readonly UnitCategory[],
    phase?: MetaPhase,
  ): UnitBaseType[] {
    const categories: readonly UnitCategory[] = Array.isArray(source)
      ? source
      : [source]
    // Stand-ins carry the declared changes: their stats and grants.
    const standIns = s.optionMetadata?.standIns ?? s
    const alive = standIns.participatingUnits + standIns.nonParticipatingUnits
    const result: UnitBaseType[] = []
    const add = (type: UnitBaseType) => {
      if (!result.includes(type)) result.push(type)
    }
    for (const category of categories) {
      for (const type of UNIT_TYPES) {
        if (isNativeCategory(standIns, type, category, phase)) add(type)
      }
      // Granted types follow the native ones; worth sorts keep ties in order.
      for (const [id, grant] of Object.entries(standIns.unitGrants ?? {})) {
        if (grant === category && alive.includes(id))
          add(parseUnitLocator(standIns.unitType[id]).baseType)
      }
    }
    return result
  }

  /** Get all unit types (participating + structures) */
  static getAllUnitTypes(): UnitBaseType[] {
    return [...new Set(UNIT_TYPES)]
  }

  /** Pick the sacrifice-priority list for `side` during `meta`. */
  static getPhasePriorityList(
    s: SideStateData,
    mode: CombatMode,
    abilitiesOverride?: Readonly<AbilitiesOverride>,
  ): UnitLocator[] | undefined {
    const key = mode === 'GROUND' ? 'groundUnitPriority' : 'spaceUnitPriority'

    // Resolution-scoped override wins over base/live config — e.g. SCO passes
    // the target side's custom unit priority via UNIT_PRIORITY.
    const up = abilitiesOverride?.UNIT_PRIORITY
    if (up !== undefined && typeof up !== 'boolean') {
      const overridden = up[key]
      if (overridden !== undefined) {
        const parsed = parsePriorityList(overridden)
        if (parsed !== undefined) return parsed
      }
    }

    const unitPriority = CombatSideState.getLiveParams(s, 'UNIT_PRIORITY')
    if (!unitPriority) return undefined
    return parsePriorityList(unitPriority[key])
  }

  /** Resolve one firing side's unit-ability priority. A custom priority on
   *  the producing ability wins; otherwise the final target side's normal
   *  UNIT_PRIORITY is inherited. The returned list defines both eligibility
   *  and assignment order. */
  static getUnitAbilityPriority(
    firing: SideStateData,
    target: SideStateData,
    meta: UnitAbilityMeta,
    abilitiesOverride?: Readonly<AbilitiesOverride>,
  ): UnitLocator[] {
    const abilityKey: keyof AbilityConfigMap =
      meta === 'AFB'
        ? 'ANTI_FIGHTER_BARRAGE'
        : meta === 'BOMBARDMENT'
          ? 'BOMBARDMENT'
          : meta === 'SPACE_CANNON_OFFENSE'
            ? 'SPACE_CANNON_OFFENSE'
            : 'SPACE_CANNON_DEFENSE'
    const base = CombatSideState.getLiveParams(firing, abilityKey) ?? {}
    const scoped = abilitiesOverride?.[abilityKey]
    const params =
      scoped !== undefined && typeof scoped !== 'boolean'
        ? { ...base, ...scoped }
        : base

    if (params.customPriority === true) {
      return parsePriorityList(params.unitPriority) ?? []
    }

    const mode: CombatMode =
      meta === 'AFB' || meta === 'SPACE_CANNON_OFFENSE' ? 'SPACE' : 'GROUND'
    return (
      CombatSideState.getPhasePriorityList(target, mode, abilitiesOverride) ??
      []
    )
  }

  // ==========================================================================
  // RESTRICTIONS (queries)
  // ==========================================================================

  /** Check if a unit ability is restricted for this variant or unit.
   *  O(1) — reads the pre-resolved cache (lazy-built on first call after
   *  each restriction or unit mutation). */
  static isRestricted(
    state: CombatStateData,
    side: CombatSide,
    layer: 'lost' | 'cannotBeUsed',
    ability: UnitAbility,
    unitType: string,
  ): boolean {
    if (!state[side].unitAbilityRestrictions) return false
    const resolved = getResolvedRestrictions(state, side)[layer].get(ability)
    if (!resolved) return false
    return resolved === 'ALL' || resolved.has(unitType as UnitType)
  }

  /** Lost or cannot be used: the unit (or type) may not use `ability`. */
  static isUnitAbilityDisabled(
    state: CombatStateData,
    side: CombatSide,
    ability: UnitAbility,
    unitType: string,
  ): boolean {
    return (
      CombatSideState.isRestricted(state, side, 'lost', ability, unitType) ||
      CombatSideState.isRestricted(
        state,
        side,
        'cannotBeUsed',
        ability,
        unitType,
      )
    )
  }

  /** Check if a unit ability is fully blocked by a blanket restriction.
   *  O(1) — reads the pre-resolved cache. */
  static isAbilityBlocked(
    state: CombatStateData,
    side: CombatSide,
    ability: UnitAbility,
  ): boolean {
    if (!state[side].unitAbilityRestrictions) return false
    const resolved = getResolvedRestrictions(state, side)
    return (
      resolved.lost.get(ability) === 'ALL' ||
      resolved.cannotBeUsed.get(ability) === 'ALL'
    )
  }

  // ==========================================================================
  // DICE COLLECTION
  // ==========================================================================

  static collectDice(
    state: CombatStateData,
    side: CombatSide,
    source: HitSource,
    sourceSurfaceId?: SurfaceId,
    instanceModifiers: readonly HitValueModifierDecl[] = [],
  ): SideDiceCollection {
    const s = state[side]
    const collection: SideDiceCollection = {}

    const scanNonParticipating =
      source === 'SPACE_CANNON' || source === 'BOMBARDMENT'

    const variantStatsCache = new Map<
      UnitType,
      readonly [number, number] | null
    >()

    const walk = (pool: UnitIdList) => {
      for (const id of pool) {
        if (sourceSurfaceId && s.unitSurface[id] !== sourceSurfaceId) continue
        const key = s.unitType[id]
        const { baseType: type } = parseUnitLocator(key)

        if (
          source !== 'COMBAT' &&
          CombatSideState.isUnitAbilityDisabled(state, side, source, id)
        )
          continue

        let die = variantStatsCache.get(key)
        if (die === undefined) {
          const stats = resolveUnitStats(s.unitStats, key)
          const dieData =
            source === 'COMBAT'
              ? stats?.COMBAT
              : stats?.UNIT_ABILITIES?.[source]
          if (!dieData) {
            variantStatsCache.set(key, null)
            continue
          }
          const [hitValue, dicePerUnit, bonusDice = 0] = dieData
          const totalDpu = dicePerUnit + bonusDice
          if (totalDpu <= 0) {
            variantStatsCache.set(key, null)
            continue
          }
          die = [hitValue, totalDpu]
          variantStatsCache.set(key, die)
        }
        if (die === null) continue

        let [hitValue, dpu] = die
        for (const mod of instanceModifiers) {
          if (mod.unitId && mod.unitId !== id) continue
          if (mod.excludeUnitTypes?.includes(type)) continue
          hitValue = Math.max(1, hitValue + mod.amount)
        }
        // Pool outer key is the base type, so galvanized + normal variants
        // of the same base type land in the same list — distinguished only
        // by `(hitValue, dpu)` of each entry.
        const list = collection[type] ?? (collection[type] = [])
        const existing = list.find(e => e[1] === hitValue && e[2] === dpu)
        if (existing) existing[0] += 1
        else list.push([1, hitValue, dpu])
      }
    }

    walk(s.participatingUnits)
    if (scanNonParticipating) walk(s.nonParticipatingUnits)

    return collection
  }

  // ==========================================================================
  // ASSIGN HITS
  // ==========================================================================

  /** Assign hits to this side. Replaces `participatingUnits` with a new
   *  array (does NOT mutate the original — safe for shared branch data).
   *  Drains the main pool first, then each custom entry in declaration order
   *  using its own `unitPriority`. The phase filter applies to both. */
  static assignHits(
    s: SideStateData,
    trackDestroyed?: boolean,
  ): Record<string, UnitId[]> {
    const pool = s.hitPool
    if (pool === undefined) return EMPTY_DESTROYED

    const mainTotal = pool.base + pool.additional
    let customTotal = 0
    for (const c of pool.custom) customTotal += c.base
    const total = mainTotal + customTotal

    if (total === 0) {
      s.hitPool = undefined
      s._hitPoolShared = false
      return EMPTY_DESTROYED
    }

    const oldUnits = s.participatingUnits
    const destroyedIds: UnitId[] = []
    const hasCustom = pool.custom.length > 0

    if (!hasCustom && !pool.unitAbilityTargets) {
      const take = Math.min(mainTotal, oldUnits.length)
      const kept = oldUnits.length - take
      s.participatingUnits = oldUnits.slice(0, kept) as UnitIdList
      if (trackDestroyed) {
        for (let i = kept; i < oldUnits.length; i++)
          destroyedIds.push(oldUnits[i] as UnitId)
      }
    } else if (fitsFighterFastPath(s, pool, oldUnits)) {
      // Single-pass fast path for the [0.0.1]-style pattern (custom
      // entry prefers non-FIGHTER, fallback to FIGHTER). Walks the
      // participating pool tail-to-head ONCE: fighters go to main (its
      // natural tail target), non-fighters go to custom (its preferred
      // tier). A second pass handles overflow (main exhausting fighters
      // spills into non-fighters; custom exhausting non-fighters spills
      // into fighters) — at most 2×N work vs the prior O(N + P×N) where
      // P is the priority list length (typically the full UNIT_PRIORITY).
      let mainRemaining = mainTotal
      let customRemaining = pool.custom[0].base
      const N = oldUnits.length
      const destroyedMask = new Uint8Array(N)

      for (
        let i = N - 1;
        i >= 0 && (mainRemaining > 0 || customRemaining > 0);
        i--
      ) {
        const id = oldUnits[i] as UnitId
        const variantKey = s.unitType[id]
        if (isFighterVariant(variantKey)) {
          if (mainRemaining > 0) {
            destroyedMask[i] = 1
            if (trackDestroyed) destroyedIds.push(id)
            mainRemaining--
          }
        } else if (customRemaining > 0) {
          destroyedMask[i] = 1
          if (trackDestroyed) destroyedIds.push(id)
          customRemaining--
        }
      }

      if (mainRemaining > 0 || customRemaining > 0) {
        for (
          let i = N - 1;
          i >= 0 && (mainRemaining > 0 || customRemaining > 0);
          i--
        ) {
          if (destroyedMask[i]) continue
          const id = oldUnits[i] as UnitId
          destroyedMask[i] = 1
          if (trackDestroyed) destroyedIds.push(id)
          if (mainRemaining > 0) mainRemaining--
          else customRemaining--
        }
      }

      let survivors = ''
      for (let i = 0; i < N; i++) {
        if (!destroyedMask[i]) survivors += oldUnits[i]
      }
      s.participatingUnits = survivors as UnitIdList
    } else {
      const working = [...oldUnits] as UnitId[]
      if (mainTotal > 0) {
        const picks = pool.unitAbilityTargets
          ? pickTargetsForCustom(
              s,
              working,
              mainTotal,
              [],
              pool.unitAbilityTargets,
            )
          : pickTailTargets(working, mainTotal)
        for (const id of picks) {
          const idx = working.indexOf(id)
          if (idx === -1) continue
          working.splice(idx, 1)
          if (trackDestroyed) destroyedIds.push(id)
        }
      }
      for (const entry of pool.custom) {
        if (entry.base <= 0) continue
        const picks = pickTargetsForCustom(
          s,
          working,
          entry.base,
          entry.unitPriority,
          pool.unitAbilityTargets,
        )
        for (const id of picks) {
          const idx = working.indexOf(id)
          if (idx === -1) continue
          working.splice(idx, 1)
          if (trackDestroyed) destroyedIds.push(id)
        }
      }
      s.participatingUnits = working.join('') as UnitIdList
    }

    s.hitPool = undefined
    s._hitPoolShared = false

    if (!trackDestroyed) return EMPTY_DESTROYED

    const destroyed: Record<string, UnitId[]> = {}
    for (const id of destroyedIds) {
      const key = s.unitType[id]
      ;(destroyed[key] ??= []).push(id)
    }
    return destroyed
  }

  /** Simulate casualties in the side's participating unit order. */
  static getAssignHitsTargets(s: SideStateData, hits: number): UnitId[] {
    return pickTailTargets(s.participatingUnits, hits)
  }

  // ==========================================================================
  // HIT POOLS (mutations)
  // ==========================================================================

  /** Add ability-produced hits to the side's main pool's `additional`
   *  slot. Creates the pool if absent. */
  static addHits(s: SideStateData, hits: number): void {
    if (hits === 0) return
    const pool = ensureHitPool(s)
    pool.additional += hits
  }

  /** Create the side's main pool with a single custom (type-restricted)
   *  entry. Caller (the public API) is responsible for asserting that
   *  no pool already exists. */
  static addCustomHits(
    s: SideStateData,
    hits: number,
    key: string,
    unitPriority: UnitLocator[],
  ): void {
    if (hits === 0) return
    const pool = ensureHitPool(s)
    pool.custom.push({
      key,
      base: hits,
      unitPriority,
    })
  }

  /** Merge a custom entry's hits into the main pool's `base` and drop the
   *  entry. Used by abilities (e.g. [0.0.1]) that lift their restriction
   *  when the producing unit is destroyed mid-round. No-op if the pool
   *  is absent or the entry isn't present. */
  static liftHitPoolRestriction(s: SideStateData, abilityKey: string): void {
    const pool = s.hitPool
    if (pool === undefined) return
    const idx = pool.custom.findIndex(c => c.key === abilityKey)
    if (idx === -1) return
    ensureHitPoolOwned(s)
    const own = s.hitPool!
    own.base += own.custom[idx].base
    own.custom.splice(idx, 1)
  }

  /** Reduce pending hits (reduces `additional` first, then `base`, then
   *  each custom entry's `base` in reverse order). */
  static reduceHits(s: SideStateData, amount: number): void {
    if (s.hitPool === undefined || amount <= 0) return
    ensureHitPoolOwned(s)
    const pool = s.hitPool!
    let remaining = amount
    for (let i = pool.custom.length - 1; i >= 0 && remaining > 0; i--) {
      const entry = pool.custom[i]
      const reduce = Math.min(remaining, entry.base)
      pool.custom[i] = { ...entry, base: entry.base - reduce }
      remaining -= reduce
    }
    const additionalReduce = Math.min(remaining, pool.additional)
    pool.additional -= additionalReduce
    remaining -= additionalReduce
    if (remaining <= 0) return
    const baseReduce = Math.min(remaining, pool.base)
    pool.base -= baseReduce
    remaining -= baseReduce
    if (remaining <= 0) return
  }

  // ==========================================================================
  // UNIT MUTATIONS
  // ==========================================================================

  /** Remove one or more units by UnitId, UnitId[], or base type (first found). */
  static removeUnits(s: SideStateData, target: UnitId | UnitId[]): void {
    if (Array.isArray(target)) {
      for (const id of target) _removeOne(s, id)
      return
    }
    _removeOne(s, target)
  }

  /** Modify per-unit mutable state. Replaces the entry (rather than
   *  mutating in place) because entry refs may be shared across branches
   *  under CoW — the outer record clone from `ensureUnitStateOwned`
   *  is shallow.
   *
   *  Does NOT mark `_needsCanonicalize` — most state mutations either
   *  (a) preserve the bijection (e.g. SUSTAIN damages the tail unit,
   *  which is already the lowest pool-ID), or (b) happen mid-step where
   *  the in-flight identity matters more than the canonical layout.
   *  Abilities that genuinely need re-canonicalization (currently only
   *  Duranium) call `SideApi.resortUnits()` explicitly, mirroring the
   *  prior `_needsResort` callsite. */
  static modifyUnitState(
    s: SideStateData,
    unitId: UnitId,
    updates: Partial<UnitState>,
  ): void {
    ensureUnitStateOwned(s)
    const existing = s.unitState[unitId]
    if (updates.isDamaged === false && !existing?.usedSustainThisRound) {
      delete s.unitState[unitId]
    } else {
      s.unitState[unitId] = existing
        ? { ...existing, ...updates }
        : { ...updates }
    }
  }

  /** Add a subtype to the given unit. Returns the new variant key on change,
   *  or undefined if the unit isn't tracked. The subtype is appended even if
   *  already present, producing a duplicated-subtype variant key — callers
   *  that want to skip duplicates should check first.
   *  Callers refresh engine bindings (invoke buckets, sort order) using the
   *  returned key. */
  static addSubtype(
    s: SideStateData,
    unitId: UnitId,
    subtype: UnitVariantId,
  ): UnitType | undefined {
    const sourceKey = s.unitType[unitId]
    if (!sourceKey) return undefined
    const { baseType: type, subtypes: currentSubtypes } =
      parseUnitLocator(sourceKey)

    const newSubtypes = [...currentSubtypes, subtype].sort()
    const newKey = makeVariantId(type, newSubtypes as UnitVariantId[])

    s.unitType = { ...s.unitType, [unitId]: newKey }
    s._resolvedRestrictions = undefined

    if (!s.unitStats[newKey]) {
      const parentStats =
        resolveUnitStats(s.unitStats, sourceKey) ??
        resolveUnitStats(s.unitStats, type)
      if (parentStats) {
        s.unitStats = { ...s.unitStats, [newKey]: { ...parentStats } }
      }
    }

    return newKey
  }

  /** Remove a subtype from the given unit. Returns the new variant key for
   *  callers to refresh engine bindings (invoke buckets, sort order), or
   *  undefined when the unit didn't have the subtype (no-op). */
  static removeSubtype(
    s: SideStateData,
    unitId: UnitId,
    subtype: UnitVariantId,
  ): UnitType | undefined {
    const sourceKey = s.unitType[unitId]
    if (!sourceKey) return undefined
    const { baseType: type, subtypes: sourceSubs } = parseUnitLocator(sourceKey)
    if (!sourceSubs.includes(subtype)) return undefined

    const newSubtypes = sourceSubs.filter(sub => sub !== subtype)
    const newKey: UnitType =
      newSubtypes.length > 0 ? makeVariantId(type, newSubtypes) : type
    if (newKey === sourceKey) return undefined

    s.unitType = { ...s.unitType, [unitId]: newKey }
    s._resolvedRestrictions = undefined
    return newKey
  }

  /**
   * Modify stats for a unit type. Returns variant keys that had ABILITIES
   * changes (for engine to queue invokes).
   */
  static modifyUnitType(
    s: SideStateData,
    key: UnitType,
    updates: Partial<UnitStats>,
  ): { keysWithAbilitiesChange: { key: UnitType; ids: UnitId[] }[] } {
    const { baseType: type } = parseUnitLocator(key)
    const isVariantKey = key.includes(':')
    const hasAbilitiesUpdate = 'ABILITIES' in updates

    const stats = { ...s.unitStats }
    for (const vKey of Object.keys(stats) as UnitType[]) {
      if (
        isVariantKey ? vKey !== key : parseUnitLocator(vKey).baseType !== type
      )
        continue
      if (!isVariantKey && typeof stats[vKey] === 'function') continue
      const current = resolveUnitStats(s.unitStats, vKey)
      if (current) stats[vKey] = { ...current, ...updates }
    }
    s.unitStats = stats
    s._resolvedRestrictions = undefined

    if (!hasAbilitiesUpdate) return { keysWithAbilitiesChange: [] }

    const buckets = new Map<UnitType, UnitId[]>()
    const bucketize = (pool: UnitIdList) => {
      for (const id of pool) {
        const unitId = id as UnitId
        const vKey = s.unitType[unitId]
        if (isVariantKey) {
          if (vKey !== key) continue
        } else {
          if (parseUnitLocator(vKey).baseType !== type) continue
        }
        let bucket = buckets.get(vKey)
        if (!bucket) buckets.set(vKey, (bucket = []))
        bucket.push(unitId)
      }
    }
    bucketize(s.participatingUnits)
    bucketize(s.nonParticipatingUnits)

    const keysWithAbilitiesChange: { key: UnitType; ids: UnitId[] }[] = []
    for (const [k, ids] of buckets)
      keysWithAbilitiesChange.push({ key: k, ids })
    return { keysWithAbilitiesChange }
  }

  /** Place new units. New UnitIds are appended to the pool matching the base
   *  type's participating status. `gen` (typically the parent CombatStateData)
   *  owns the codepoint counter so freshly minted IDs never collide across
   *  sides. */
  static placeUnits(
    s: SideStateData,
    state: Pick<
      CombatStateData,
      '_nextCode' | 'surfaces' | 'combatMode' | 'activeSurfaceId' | 'meta'
    >,
    unitsToAdd: Partial<Record<UnitType, number>>,
    destination: SurfaceId,
  ): Record<UnitType, UnitId[]> {
    const destinationSurface = state.surfaces.find(
      surface => surface.id === destination,
    )
    if (!destinationSurface) throw new Error(`Unknown surface: ${destination}`)
    const placed: Record<UnitType, UnitId[]> = {} as Record<UnitType, UnitId[]>

    let nextPart = s.participatingUnits
    let nextNon = s.nonParticipatingUnits
    let nextUnitType = s.unitType
    let nextUnitSurface = s.unitSurface

    for (const [variantKey, count] of Object.entries(unitsToAdd)) {
      const vKey = variantKey as UnitType
      if (!count || count <= 0) continue

      const baseType = parseUnitLocator(vKey).baseType as UnitBaseType
      const stats = CombatSideState.getUnitStats(s, vKey)
      const allowedSurfaces =
        stats?.ALLOWED_SURFACES ?? DEFAULT_UNIT_SURFACES[baseType]
      if (!allowedSurfaces.includes(destinationSurface.type)) {
        throw new Error(
          `${baseType} cannot be placed on ${destinationSurface.type}`,
        )
      }

      const existing = countUnitsByBaseType(s, baseType)

      const limit = UNIT_LIMITS[baseType]
      if (existing + count > limit) {
        console.warn(
          `Unit limit exceeded: ${baseType} has a maximum of ${limit}`,
        )
      }
      const allowed = Math.min(count, limit - existing)
      if (allowed <= 0) continue

      const newIds = nextUnitIds(allowed, state)
      if (
        participatesNatively(
          s,
          vKey,
          destination,
          state.combatMode,
          state.activeSurfaceId,
          state.meta,
        )
      ) {
        nextPart = (nextPart + newIds.join('')) as UnitIdList
      } else {
        nextNon = (nextNon + newIds.join('')) as UnitIdList
      }
      const typeMapAdditions: Record<UnitId, UnitType> = {}
      const surfaceMapAdditions: Record<UnitId, SurfaceId> = {}
      for (const id of newIds) {
        typeMapAdditions[id] = vKey
        surfaceMapAdditions[id] = destination
      }
      nextUnitType = { ...nextUnitType, ...typeMapAdditions }
      nextUnitSurface = { ...nextUnitSurface, ...surfaceMapAdditions }

      // Stats for vKey are pre-populated by buildSideState; if missing
      // (test fixtures bypassing declareSubtype), seed an empty record so
      // resolveUnitStats can fall back to the parent.
      if (!s.unitStats[vKey]) {
        s.unitStats = { ...s.unitStats, [vKey]: {} }
      }

      placed[vKey] = newIds
    }

    // Placing nothing leaves the side untouched.
    if (nextUnitSurface === s.unitSurface) return placed

    s.participatingUnits = nextPart
    s.nonParticipatingUnits = nextNon
    s.unitType = nextUnitType
    s.unitSurface = nextUnitSurface
    s._resolvedRestrictions = undefined

    return placed
  }

  static moveUnits(
    s: SideStateData,
    unitIds: readonly UnitId[],
    destination: SurfaceId,
  ): void {
    if (unitIds.length === 0) return
    const moving = new Set(unitIds.filter(id => CombatSideState.hasUnit(s, id)))
    if (moving.size === 0) return
    const unitSurface = { ...s.unitSurface }
    for (const id of unitIds) {
      if (!moving.has(id)) continue
      unitSurface[id] = destination
    }
    s.unitSurface = unitSurface
    // Surface-scoped restrictions resolve to the ids standing on the surface.
    s._resolvedRestrictions = undefined
  }

  // ==========================================================================
  // RESTRICTIONS (mutations)
  // ==========================================================================

  static addRestriction(
    state: CombatStateData,
    side: CombatSide,
    layer: 'lost' | 'cannotBeUsed',
    ability: UnitAbility,
    reason: string,
    target?: UnitBaseType | UnitCategory,
    surfaceId?: SurfaceId,
  ): void {
    const s = state[side]
    const isCategory = target !== undefined && target in UNIT_CATEGORIES
    s.unitAbilityRestrictions = addRestrictionEntry(
      s.unitAbilityRestrictions,
      layer,
      ability,
      reason,
      isCategory ? undefined : (target as UnitBaseType | undefined),
      isCategory ? (target as UnitCategory) : undefined,
      surfaceId,
    )
    // Cascade crosses sides — drop both caches.
    invalidateResolvedRestrictions(state)
  }

  static removeRestriction(
    state: CombatStateData,
    side: CombatSide,
    layer: 'lost' | 'cannotBeUsed',
    ability: UnitAbility,
    reason: string,
    target?: UnitBaseType | UnitCategory,
    surfaceId?: SurfaceId,
  ): void {
    const s = state[side]
    const isCategory = target !== undefined && target in UNIT_CATEGORIES
    s.unitAbilityRestrictions = removeRestrictionEntry(
      s.unitAbilityRestrictions,
      layer,
      ability,
      reason,
      isCategory ? undefined : (target as UnitBaseType | undefined),
      isCategory ? (target as UnitCategory) : undefined,
      surfaceId,
    )
    invalidateResolvedRestrictions(state)
  }

  /** Make `unitType` ignore every restriction whose `reason` matches —
   *  both layers, blanket entries included. Resolved lazily, so the order
   *  against the restriction's own PREPARE doesn't matter. */
  static addRestrictionImmunity(
    state: CombatStateData,
    side: CombatSide,
    reason: string,
    unitType: UnitBaseType,
  ): void {
    const s = state[side]
    s.unitAbilityRestrictions = addImmunityEntry(
      s.unitAbilityRestrictions,
      reason,
      unitType,
    )
    invalidateResolvedRestrictions(state)
  }

  static removeRestrictionImmunity(
    state: CombatStateData,
    side: CombatSide,
    reason: string,
    unitType: UnitBaseType,
  ): void {
    const s = state[side]
    s.unitAbilityRestrictions = removeImmunityEntry(
      s.unitAbilityRestrictions,
      reason,
      unitType,
    )
    invalidateResolvedRestrictions(state)
  }
}

/** Standalone convenience re-export. Prefer `CombatSideState.getOpponentSide`
 *  for new code; this alias exists for ergonomic call sites that flip sides
 *  frequently (e.g. `getOpponentSide(this._side)`). */
export const getOpponentSide = CombatSideState.getOpponentSide
