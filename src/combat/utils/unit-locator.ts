import { UNIT_TYPES } from '@/constants/units'
import type {
  SurfaceId,
  SurfaceUnitKey,
  UnitLocator,
  UnitType,
  UnitVariantId,
} from '@/types'

import type { SideStateData } from '../combat-state/types'
import { parseUnitLocator } from './parse-unit-locator'
import { makeVariantId, matchesVariantSuperset } from './unit-variant'

const escapePart = (value: string) =>
  encodeURIComponent(value).replaceAll('~', '%7E')

const locatorCache = new Map<SurfaceId, Map<UnitType, SurfaceUnitKey>>()

/** Cached: priority ranking builds locators on hot paths. */
export function makeUnitLocator(
  unitType: UnitType,
  surfaceId: SurfaceId,
): SurfaceUnitKey {
  let bySurface = locatorCache.get(surfaceId)
  if (!bySurface) locatorCache.set(surfaceId, (bySurface = new Map()))
  let locator = bySurface.get(unitType)
  if (!locator) {
    locator =
      `@${escapePart(surfaceId)}/${escapePart(unitType)}` as SurfaceUnitKey
    bySurface.set(unitType, locator)
  }
  return locator
}

type LocatedSide = Pick<SideStateData, 'unitType' | 'unitSurface'>

function matchesParsedLocator(
  side: LocatedSide,
  id: string,
  unitType: UnitType,
  surfaceId: SurfaceId | undefined,
  includeVariants: boolean,
): boolean {
  if (surfaceId !== undefined && side.unitSurface[id] !== surfaceId)
    return false
  const actual = side.unitType[id]
  return (
    actual !== undefined &&
    (includeVariants
      ? matchesVariantSuperset(actual, unitType)
      : actual === unitType)
  )
}

export function matchesUnitLocator(
  side: LocatedSide,
  id: string,
  locator: UnitLocator,
  includeVariants = false,
): boolean {
  // A plain variant key is its own unit type: skip parsing on this hot path.
  if (!includeVariants && !locator.startsWith('@'))
    return side.unitType[id] === locator
  const { unitType, surfaceId } = parseUnitLocator(locator)
  return matchesParsedLocator(side, id, unitType, surfaceId, includeVariants)
}

/** `matchesUnitLocator` with the locator parsed once, for id loops. */
export function unitLocatorMatcher(
  side: LocatedSide,
  locator: UnitLocator,
  includeVariants = false,
): (id: string) => boolean {
  if (!includeVariants && !locator.startsWith('@'))
    return id => side.unitType[id] === locator
  const { unitType, surfaceId } = parseUnitLocator(locator)
  return id =>
    matchesParsedLocator(side, id, unitType, surfaceId, includeVariants)
}

/** Enabled entries of one `UnitList`, parsed once. */
interface CompiledUnitList {
  /** Unqualified keys: exact-variant matches need only a Set lookup. */
  plain: ReadonlySet<string>
  /** Surface-qualified entries, parsed. */
  located: readonly { unitType: UnitType; surfaceId: SurfaceId }[]
  /** Every entry, parsed, for variant-superset matching. */
  all: readonly { unitType: UnitType; surfaceId: SurfaceId | undefined }[]
}

/** Keyed by list identity: ability params replace lists, never mutate them. */
const compiledUnitLists = new WeakMap<object, CompiledUnitList>()

function compileUnitList(
  list: readonly (readonly [string, ...unknown[]])[],
): CompiledUnitList {
  let compiled = compiledUnitLists.get(list)
  if (compiled) return compiled
  const plain = new Set<string>()
  const located: CompiledUnitList['located'][number][] = []
  const all: CompiledUnitList['all'][number][] = []
  for (const entry of list) {
    // Same enabled-entry rule as `ctx.utils.getFlat`.
    if (entry.length >= 2 && (entry[1] === false || entry[1] === 0)) continue
    const { unitType, surfaceId } = parseUnitLocator(entry[0])
    all.push({ unitType, surfaceId })
    if (surfaceId === undefined) plain.add(entry[0])
    else located.push({ unitType, surfaceId })
  }
  compiled = { plain, located, all }
  compiledUnitLists.set(list, compiled)
  return compiled
}

/** Whether the unit matches any enabled entry of a `UnitList` — the
 *  `getFlat(list).some(target => matchesUnitLocator(...))` check, with the
 *  list compiled once per list object. */
export function matchesUnitList(
  side: LocatedSide,
  id: string,
  list: readonly (readonly [string, ...unknown[]])[],
  includeVariants = false,
): boolean {
  const compiled = compileUnitList(list)
  if (includeVariants) {
    for (const { unitType, surfaceId } of compiled.all) {
      if (matchesParsedLocator(side, id, unitType, surfaceId, true)) return true
    }
    return false
  }
  const actual = side.unitType[id]
  if (actual === undefined) return false
  if (compiled.plain.has(actual)) return true
  for (const { unitType, surfaceId } of compiled.located) {
    if (actual === unitType && side.unitSurface[id] === surfaceId) return true
  }
  return false
}

export function locatorWithSubtype(
  locator: UnitLocator,
  subtype: UnitVariantId,
): UnitLocator {
  const { unitType, surfaceId } = parseUnitLocator(locator)
  const variant = makeVariantId(unitType, [subtype])
  return surfaceId === undefined ? variant : makeUnitLocator(variant, surfaceId)
}

/** Exact variant first, then the base on that surface, then legacy defaults. */
export function unitLocatorRank(
  rank: ReadonlyMap<string, number>,
  unitType: UnitType,
  surfaceId?: SurfaceId,
): number {
  const base = parseUnitLocator(unitType).baseType
  return (
    (surfaceId === undefined
      ? undefined
      : (rank.get(makeUnitLocator(unitType, surfaceId)) ??
        rank.get(makeUnitLocator(base, surfaceId)))) ??
    rank.get(unitType) ??
    rank.get(base) ??
    Infinity
  )
}

/** Used at external config boundaries before locator keys reach reconciliation. */
export function isValidUnitLocator(value: string): boolean {
  if (!value.startsWith('@')) return true
  try {
    const { baseType, surfaceId } = parseUnitLocator(value)
    return !!surfaceId && UNIT_TYPES.includes(baseType)
  } catch {
    return false
  }
}
