import { parseUnitLocator } from '@/combat/utils/parse-unit-locator'
import { makeUnitLocator } from '@/combat/utils/unit-locator'
import { makeVariantId } from '@/combat/utils/unit-variant'

export function reconcileStringParam(
  current: string,
  validList: string[],
): string {
  if (validList.includes(current)) return current
  return validList[0] ?? current
}

type UnitListEntry = [string] | [string, unknown]

const NO_PARENT = Symbol('no-parent')

function inheritedValue(
  newKey: string,
  byKey: Map<string, unknown>,
): unknown | typeof NO_PARENT {
  const { baseType: type, subtypes, surfaceId } = parseUnitLocator(newKey)
  const remaining = [...subtypes]
  while (remaining.length) {
    remaining.pop()
    const parent = makeVariantId(type, remaining)
    const key =
      surfaceId === undefined ? parent : makeUnitLocator(parent, surfaceId)
    if (byKey.has(key)) return byKey.get(key)
  }
  return NO_PARENT
}

/** Reconcile a `UnitList<V>` (tuple-array) param against a fresh validList.
 *  - Drops entries whose key is no longer valid, unless `keep` holds for
 *    it: those stay in place, hidden from the controls.
 *  - Preserves user-set order and per-key value for entries that survive.
 *  - Adds missing keys at their natural validList position. Subtype
 *    variants inherit their parent's value when the parent is present;
 *    otherwise the entry is built with `defaultItemValue` (or as a
 *    length-1 tuple `[key]` when `defaultItemValue` is omitted).
 *  - When `maxFor` is supplied, numeric values are clamped to the returned
 *    maximum (both kept entries and newly inserted ones). Non-finite maxes
 *    (Infinity) are treated as no-clamp.
 *  - `inherit: false` builds every new entry from `defaultItemValue`, for
 *    counts a subtype must not copy from its parent. */
export function reconcileUnitListParam(
  current: readonly (UnitListEntry | string)[],
  validList: readonly string[],
  defaultItemValue?: unknown,
  maxFor?: (variantKey: string) => number,
  keep?: (key: string) => boolean,
  inherit = true,
): UnitListEntry[] {
  // Order-mode lists round-trip through the URL as flat string arrays —
  // normalize those to 1-tuples here so reconcile treats both shapes
  // identically (matches the runtime contract of `unwrapUnitListKeys`).
  const normalized: UnitListEntry[] = current.map(entry =>
    typeof entry === 'string' ? [entry] : (entry as UnitListEntry),
  )
  const validSet = new Set(validList)
  const kept = normalized.filter(
    entry => validSet.has(entry[0]) || keep?.(entry[0]),
  )
  const keptKeys = new Set(kept.map(entry => entry[0]))
  const newKeys = validList.filter(key => !keptKeys.has(key))

  const clamp = (key: string, value: unknown): unknown => {
    if (!maxFor) return value
    if (typeof value !== 'number') return value
    const max = maxFor(key)
    if (!Number.isFinite(max)) return value
    return value > max ? max : value
  }

  if (newKeys.length === 0)
    return kept.map(entry => {
      const copy = [...entry] as UnitListEntry
      if (copy.length === 2) copy[1] = clamp(copy[0], copy[1])
      return copy
    })

  const result: UnitListEntry[] = kept.map(entry => {
    const copy = [...entry] as UnitListEntry
    if (copy.length === 2) copy[1] = clamp(copy[0], copy[1])
    return copy
  })
  const valuesByKey = new Map<string, unknown>(
    result.map(entry => [entry[0], entry[1]]),
  )

  for (const newKey of newKeys) {
    const validIndex = validList.indexOf(newKey)
    let insertAt = 0
    for (let i = 0; i < result.length; i++) {
      const itemValidIndex = validList.indexOf(result[i][0])
      if (itemValidIndex !== -1 && itemValidIndex < validIndex) {
        insertAt = i + 1
      }
    }
    const inherited = inherit ? inheritedValue(newKey, valuesByKey) : NO_PARENT
    let entry: UnitListEntry
    if (inherited !== NO_PARENT && inherited !== undefined) {
      entry = [newKey, clamp(newKey, inherited)]
    } else if (defaultItemValue !== undefined) {
      entry = [newKey, clamp(newKey, defaultItemValue)]
    } else {
      entry = [newKey]
    }
    result.splice(insertAt, 0, entry)
    valuesByKey.set(newKey, entry.length === 2 ? entry[1] : undefined)
  }

  return result
}
