import { UNIT_DISPLAY_NAMES } from '@/constants/units'
import type { UnitType, UnitVariantId } from '@/types'

import { parseUnitLocator } from './parse-unit-locator'

/**
 * A variant ID is a UnitBaseType optionally suffixed with sorted subtypes.
 * Examples: "CRUISER", "CRUISER:Cavalry", "CRUISER:Cavalry,Galvanize"
 * A plain UnitBaseType string is a valid UnitVariantId (variant with no subtypes).
 */

export function makeVariantId(
  variantId: UnitType,
  subtypes?: UnitVariantId[],
): UnitType {
  if (!subtypes || subtypes.length === 0) return variantId
  const { baseType: type, subtypes: currentSubtypes } =
    parseUnitLocator(variantId)
  const sorted = [...subtypes, ...currentSubtypes].sort()
  return `${type}:${sorted.join(',')}` as UnitType
}

/** Variant-superset match: `unitVariantId` matches `queryVariantId` when they
 *  share a base type and the unit's subtypes include every subtype required
 *  by the query. Used by `getUnits` / `hasUnitType` / etc. when called with
 *  `includeVariants: true`: querying `INFANTRY:Evelyn` matches
 *  `INFANTRY:Evelyn,Galvanized` but not `INFANTRY:Galvanized`. */
export function matchesVariantSuperset(
  unitVariantId: UnitType,
  queryVariantId: UnitType,
): boolean {
  const u = parseUnitLocator(unitVariantId)
  const q = parseUnitLocator(queryVariantId)
  if (u.baseType !== q.baseType) return false
  for (const sub of q.subtypes) {
    if (!u.subtypes.includes(sub)) return false
  }
  return true
}

export function getVariantDisplayName(id: UnitType): string {
  const { baseType: type, subtypes } = parseUnitLocator(id)
  const base = UNIT_DISPLAY_NAMES[type]
  if (subtypes.length === 0) return base
  return `${base} (${subtypes.join(', ')})`
}
