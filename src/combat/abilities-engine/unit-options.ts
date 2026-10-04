import {
  type CombatSide,
  SPACE_SURFACE_ID,
  type SurfaceDefinition,
  type SurfaceId,
  type UnitBaseType,
  type UnitId,
  type UnitType,
} from '@/types'

import {
  CombatSideState,
  applyVariantPostFilter,
  filterDeclaredSubtypes,
} from '../combat-side-state/combat-side-state'
import { getCombatMeta } from '../combat-state/phase-utils'
import type { CombatMode, SideStateData } from '../combat-state/types'
import { parseUnitLocator } from '../utils/parse-unit-locator'
import {
  expandWithSubtypes,
  sortBaseTypes,
  sortVariantsByCombat,
} from '../utils/sort-unit-options'
import { isUnitCategory } from '../utils/unit-combat-properties'
import { makeUnitLocator } from '../utils/unit-locator'
import { getVariantDisplayName } from '../utils/unit-variant'
import { resolveVariantLimit } from './param-limit'
import type { SyncSourceConfig, UnitOption } from './types'

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
  'source' | 'filter' | 'scope' | 'limit'
> & {
  sort?: SyncSourceConfig['sort']
  /** Key of the ability declaring the param, for `filter.withAbility`. */
  abilityKey?: string
}

/** Keep the types whose units carry the ability `abilityKey`. */
function filterAbilityHolders(
  s: SideStateData,
  types: readonly UnitBaseType[],
  abilityKey: string | undefined,
): UnitBaseType[] {
  if (abilityKey === undefined)
    throw new Error('filter.withAbility needs the declaring ability key')
  // Reconcile lists the holders as if the ability were switched on;
  // otherwise the setup model carries the declared changes: upgrade cards
  // and copies.
  const holders =
    s.optionMetadata?.abilityHolders?.[abilityKey] ??
    CombatSideState.getUnitTypesWithAbility(
      s.optionMetadata?.model ?? s,
      abilityKey,
    )
  const baseTypes = new Set(
    holders.map(type => parseUnitLocator(type).baseType),
  )
  return types.filter(type => baseTypes.has(type))
}

/** The same candidates and caps drive reconciliation and UI controls. */
export function resolveUnitOptions(
  s: SideStateData,
  context: UnitOptionContext,
  spec: OptionSpec,
): UnitOption[] {
  const mode = spec.filter?.combatMode ?? context.combatMode
  // Choices are made for the mode's combat, so phase-scoped categories of
  // that combat count.
  const phase = getCombatMeta(mode)
  const sourceTypes = spec.filter?.includeNonParticipating
    ? CombatSideState.getAllUnitTypes()
    : CombatSideState.getCategoryOptionTypes(s, spec.source, phase)
  const types = spec.filter?.withAbility
    ? filterAbilityHolders(s, sourceTypes, spec.abilityKey)
    : sourceTypes
  const sorted = sortBaseTypes(types, spec.sort ?? 'normal-asc')
  const subtypes = spec.filter?.includeOnlyBaseTypes
    ? []
    : filterDeclaredSubtypes(s.optionMetadata?.subtypes ?? [], spec.filter)
  const expanded = applyVariantPostFilter(
    expandWithSubtypes(sorted, subtypes, spec.sort),
    spec.filter,
  ) as UnitType[]
  // The setup model carries the stats active abilities change.
  const variants =
    spec.sort === 'combat-asc' || spec.sort === 'combat-desc'
      ? sortVariantsByCombat(
          expanded,
          spec.sort,
          (s.optionMetadata?.model ?? s).unitStats,
          s.optionMetadata?.subtypes ?? [],
        )
      : expanded
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
  // Where a unit fights, mirroring `participatesInCombat` and commitment:
  // ships where they stand, ground forces on an active planet, and the
  // attacker's ground forces from space on the invaded planet. System
  // controls keep units where they stand.
  const fightsOn = (side: SideStateData, id: UnitId): readonly SurfaceId[] => {
    const surface = side.unitSurface[id]
    if (spec.scope === 'system') return [surface]
    if (!isUnitCategory(side, id, category, phase)) return []
    if (mode === 'SPACE') return [surface]
    if (surface === SPACE_SURFACE_ID)
      return context.side === 'attacker' ? [...active] : []
    return active.has(surface) ? [surface] : []
  }
  const units = (side: SideStateData) =>
    [...side.participatingUnits, ...side.nonParticipatingUnits] as UnitId[]
  // Choices describe the units that may fight, not just the starting force:
  // the setup model adds the units active abilities may place, and its units
  // decide where the units of their type on their surface fight.
  const model = s.optionMetadata?.model ?? s
  const offered = new Set(types)
  const reach = new Map<UnitBaseType, Map<SurfaceId, readonly SurfaceId[]>>()
  for (const id of units(model)) {
    const base = parseUnitLocator(model.unitType[id]).baseType
    if (!offered.has(base)) continue
    let bySurface = reach.get(base)
    if (!bySurface) reach.set(base, (bySurface = new Map()))
    const fights = fightsOn(model, id)
    const known = bySurface.get(model.unitSurface[id])
    bySurface.set(
      model.unitSurface[id],
      known ? [...new Set([...known, ...fights])] : fights,
    )
  }
  // Fielded units supply the caps.
  const projected = new Map<SurfaceId, Map<UnitBaseType, Set<UnitId>>>()
  for (const id of units(s)) {
    const surface = s.unitSurface[id]
    const base = parseUnitLocator(s.unitType[id]).baseType
    if (!offered.has(base)) continue
    for (const target of reach.get(base)?.get(surface) ?? fightsOn(s, id)) {
      let byBase = projected.get(target)
      if (!byBase) projected.set(target, (byBase = new Map()))
      let ids = byBase.get(base)
      if (!ids) byBase.set(base, (ids = new Set()))
      ids.add(id)
    }
  }
  const items: UnitOption[] = []
  for (const variant of variants) {
    const { baseType: base, subtypes: variantSubs } = parseUnitLocator(variant)
    const reachable = new Set([...(reach.get(base)?.values() ?? [])].flat())
    surfaces.forEach((surface, surfaceOrder) => {
      const ids = [...(projected.get(surface.id)?.get(base) ?? [])]
      if (!reachable.has(surface.id) && !ids.length) return
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
