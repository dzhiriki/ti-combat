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
  const { unitType, surfaceId } = parseUnitLocator(locator)
  return matchesParsedLocator(side, id, unitType, surfaceId, includeVariants)
}

/** `matchesUnitLocator` with the locator parsed once, for id loops. */
export function unitLocatorMatcher(
  side: LocatedSide,
  locator: UnitLocator,
  includeVariants = false,
): (id: string) => boolean {
  const { unitType, surfaceId } = parseUnitLocator(locator)
  return id =>
    matchesParsedLocator(side, id, unitType, surfaceId, includeVariants)
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
