import { DEFAULT_UNIT_SURFACES } from '@/constants/units'
import type {
  CombatSide,
  SurfaceDefinition,
  SurfaceId,
  UnitBaseType,
  UnitId,
  UnitType,
} from '@/types'

import {
  CombatSideState,
  applyVariantPostFilter,
  filterDeclaredSubtypes,
} from '../combat-side-state/combat-side-state'
import type { CombatMode, SideStateData } from '../combat-state/types'
import { parseUnitLocator } from '../utils/parse-unit-locator'
import { resolveUnitStats } from '../utils/resolve-unit-stats'
import { expandWithSubtypes, sortBaseTypes } from '../utils/sort-unit-options'
import { makeUnitLocator } from '../utils/unit-locator'
import { getVariantDisplayName } from '../utils/unit-variant'
import { resolveVariantLimit } from './param-limit'
import type { ParamChange, SyncSourceConfig, UnitOption } from './types'

export interface UnitOptionContext {
  combatMode: CombatMode
  activeSurfaceId?: SurfaceId
  surfaces?: readonly SurfaceDefinition[]
  side: CombatSide
  /** Treat every surface of the option's mode as active. Reconcile uses this
   *  so choices for an unselected planet survive planet and mode switches. */
  allSurfaces?: boolean
}

type OptionSpec = Pick<
  SyncSourceConfig,
  'source' | 'sort' | 'filter' | 'scope' | 'limit'
>

/** The same candidates and caps drive reconciliation and UI controls. */
export function resolveUnitOptions(
  s: SideStateData,
  context: UnitOptionContext,
  spec: OptionSpec,
): UnitOption[] {
  const mode = spec.filter?.combatMode ?? context.combatMode
  const types = CombatSideState.getCategoryOptionTypes(s, spec.source)
  const sorted = sortBaseTypes(types, spec.sort)
  const subtypes = spec.filter?.includeOnlyBaseTypes
    ? []
    : filterDeclaredSubtypes(s.declaredSubtypes ?? [], spec.filter)
  const variants = applyVariantPostFilter(
    expandWithSubtypes(sorted, subtypes, spec.sort),
    spec.filter,
  ) as UnitType[]
  const surfaces = context.surfaces
  if (spec.scope === 'type' || !surfaces || !context.activeSurfaceId) {
    return variants
      .map(value => ({
        label: getVariantDisplayName(value),
        value,
        ...(spec.limit
          ? { max: resolveVariantLimit(spec.limit, s, value) }
          : {}),
      }))
      .filter(
        item =>
          !spec.filter?.includeOnlyAvailable ||
          item.max === undefined ||
          item.max > 0,
      )
  }

  const surfaceType = mode === 'SPACE' ? 'SPACE' : 'PLANET'
  const candidates = surfaces.filter(surface => surface.type === surfaceType)
  const selected = context.allSurfaces
    ? candidates
    : candidates.filter(surface => surface.id === context.activeSurfaceId)
  const active = new Set(
    (selected.length ? selected : candidates.slice(0, 1)).map(
      surface => surface.id,
    ),
  )
  if (!active.size) return []
  const category = mode === 'SPACE' ? 'SHIPS' : 'GROUND_FORCES'
  const categoryTypes = new Map<string, UnitBaseType[]>()
  const typesOf = (key: 'SHIPS' | 'GROUND_FORCES' | 'STRUCTURES') => {
    let result = categoryTypes.get(key)
    if (!result) {
      result = CombatSideState.getCategoryOptionTypes(s, key)
      categoryTypes.set(key, result)
    }
    return result
  }
  const participatingTypes = typesOf(category)
  const changes = s.unitCategoryChanges ?? []
  const matchesChange = (base: UnitBaseType, change: ParamChange) => {
    return (
      change.key === category &&
      (change.value === base ||
        (change.value in (s.unitCategoryOptions ?? {}) &&
          typesOf(
            change.value as 'SHIPS' | 'GROUND_FORCES' | 'STRUCTURES',
          ).includes(base)))
    )
  }
  const spaceSurfaces = new Set(
    surfaces
      .filter(surface => surface.type === 'SPACE')
      .map(surface => surface.id),
  )
  const alive = [
    ...s.participatingUnits,
    ...s.nonParticipatingUnits,
  ] as UnitId[]
  // Map setup units onto the surface where they can participate. System
  // controls always use their physical location before commitment.
  const projected = new Map<SurfaceId, Map<UnitBaseType, Set<UnitId>>>()
  const add = (surface: SurfaceId, base: UnitBaseType, id: UnitId) => {
    let byBase = projected.get(surface)
    if (!byBase) projected.set(surface, (byBase = new Map()))
    let ids = byBase.get(base)
    if (!ids) byBase.set(base, (ids = new Set()))
    ids.add(id)
  }
  const commit = (base: UnitBaseType, id: UnitId) => {
    for (const surface of active) add(surface, base, id)
  }
  for (const id of alive) {
    const surface = s.unitSurface[id]
    const base = parseUnitLocator(s.unitType[id]).baseType
    if (spec.scope === 'system') {
      add(surface, base, id)
      continue
    }
    const grant = s.unitCombat?.[id]?.participating
    if (grant === false) continue
    const participates = participatingTypes.includes(base)
    if (grant === true || (active.has(surface) && participates))
      add(surface, base, id)
    const inSpace = spaceSurfaces.has(surface)
    if (
      mode === 'GROUND' &&
      context.side === 'attacker' &&
      inSpace &&
      participates
    )
      commit(base, id)
    for (const change of changes) {
      if (!matchesChange(base, change)) continue
      if (change.scope === 'system') add(surface, base, id)
      if (change.scope === 'commit' && inSpace && context.side === 'attacker')
        commit(base, id)
    }
  }
  const items: UnitOption[] = []
  for (const variant of variants) {
    const { baseType: base, subtypes: variantSubs } = parseUnitLocator(variant)
    const allowedSurfaces =
      resolveUnitStats(s.unitStats, variant)?.ALLOWED_SURFACES ??
      DEFAULT_UNIT_SURFACES[base]
    const participates = participatingTypes.includes(base)
    const systemChange = changes.some(
      change => change.scope === 'system' && matchesChange(base, change),
    )
    surfaces.forEach((surface, surfaceOrder) => {
      const ids = [...(projected.get(surface.id)?.get(base) ?? [])]
      // Choices describe units that may exist later, not just the starting
      // force. Declarations add remote surfaces; fielded ids supply caps and
      // explicit runtime participation, never the default option catalog.
      const eligibleSurface =
        spec.scope === 'system'
          ? allowedSurfaces.includes(surface.type)
          : (active.has(surface.id) && participates) || systemChange
      if (!eligibleSurface && !ids.length) return
      if (
        variantSubs.length &&
        !ids.some(id => s.unitType[id] === variant) &&
        !variantSubs.every(sub =>
          subtypes.some(
            declaration =>
              declaration.name === sub &&
              parseUnitLocator(declaration.unitType).baseType === base &&
              (!declaration.surfaces ||
                declaration.surfaces.includes(surface.id) ||
                ids.some(id =>
                  declaration.surfaces!.includes(s.unitSurface[id]),
                )),
          ),
        )
      )
        return
      const value = makeUnitLocator(variant, surface.id)
      const max =
        spec.limit === 'IN_COMBAT'
          ? ids.length
          : spec.limit
            ? resolveVariantLimit(spec.limit, s, value)
            : undefined
      if (spec.filter?.includeOnlyAvailable && max === 0) return
      items.push({
        label: getVariantDisplayName(variant),
        value,
        surfaceId: surface.id,
        surfaceName: surface.name,
        surfaceOrder,
        ...(max === undefined ? {} : { max }),
      })
    })
  }
  return items
}

type UnitTargetEntry = string | readonly [string, ...unknown[]]

const entryKey = (entry: UnitTargetEntry) =>
  typeof entry === 'string' ? entry : entry[0]

const copyEntry = (entry: UnitTargetEntry): string | [string, ...unknown[]] =>
  typeof entry === 'string' ? entry : [...entry]

/** Expand legacy settings once, without multiplying a numeric total. */
export function expandLegacyUnitTargets(
  current: readonly UnitTargetEntry[],
  options: readonly UnitOption[],
  s: SideStateData,
): (string | [string, ...unknown[]])[] {
  const qualified = new Set(
    current.map(entryKey).filter(key => key.startsWith('@')),
  )
  return current.flatMap(entry => {
    const key = entryKey(entry)
    if (key.startsWith('@')) return [copyEntry(entry)]
    const candidates = options.filter(option => {
      const { unitType, surfaceId } = parseUnitLocator(option.value)
      return (
        surfaceId !== undefined &&
        unitType === key &&
        !qualified.has(option.value)
      )
    })
    if (!candidates.length) return [copyEntry(entry)]
    const value = typeof entry === 'string' ? undefined : entry[1]
    if (typeof value !== 'number')
      return candidates.map(option =>
        typeof entry === 'string'
          ? option.value
          : ([option.value, ...entry.slice(1)] as [string, ...unknown[]]),
      )
    // Match the old system query's participating-first traversal.
    const surfaceOrder = [...s.participatingUnits, ...s.nonParticipatingUnits]
      .filter(id => s.unitType[id] === key)
      .map(id => s.unitSurface[id])
    const ordered = [...candidates].sort((a, b) => {
      const ai = surfaceOrder.indexOf(a.surfaceId!),
        bi = surfaceOrder.indexOf(b.surfaceId!)
      return (ai < 0 ? Infinity : ai) - (bi < 0 ? Infinity : bi)
    })
    let remaining = value
    return ordered.map(option => {
      const count = Math.min(remaining, option.max ?? Infinity)
      remaining -= count
      return [option.value, count] as [string, number]
    })
  })
}
