import type { SurfaceId, UnitBaseType, UnitType, UnitVariantId } from '@/types'

interface ParsedUnitLocator {
  unitType: UnitType
  baseType: UnitBaseType
  subtypes: UnitVariantId[]
  surfaceId?: SurfaceId
}

const EMPTY_SUBTYPES: UnitVariantId[] = []
const cache = new Map<string, ParsedUnitLocator>()

/** Decode both legacy variant keys and surface-qualified selections.
 *  Validation stays at config boundaries; cached results must not be mutated. */
export function parseUnitLocator(value: string): ParsedUnitLocator {
  const cached = cache.get(value)
  if (cached) return cached

  let unitType = value as UnitType
  let surfaceId: SurfaceId | undefined
  if (value.startsWith('@')) {
    const separator = value.indexOf('/')
    if (separator < 2) throw new Error(`Invalid unit locator: ${value}`)
    surfaceId = decodeURIComponent(value.slice(1, separator)) as SurfaceId
    unitType = decodeURIComponent(value.slice(separator + 1)) as UnitType
  }

  const colonIndex = unitType.indexOf(':')
  const result: ParsedUnitLocator = {
    unitType,
    baseType: (colonIndex < 0
      ? unitType
      : unitType.slice(0, colonIndex)) as UnitBaseType,
    subtypes:
      colonIndex < 0
        ? EMPTY_SUBTYPES
        : (unitType.slice(colonIndex + 1).split(',') as UnitVariantId[]),
    surfaceId,
  }
  cache.set(value, result)
  return result
}
