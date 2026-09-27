import type { UnitStats, UnitType } from '@/types'

import type { SideStateData } from '../combat-state/types'
import { parseUnitLocator } from './parse-unit-locator'
import { makeVariantId } from './unit-variant'

/**
 * Resolve a unitStats entry to concrete UnitStats.
 * If the entry is a factory function, applies it to the nearest parent with
 * concrete stats (tries each one-subtype-removed variant, then base type).
 */
export function resolveUnitStats(
  unitStats: SideStateData['unitStats'],
  key: UnitType,
): UnitStats | undefined {
  const entry = unitStats[key]
  if (!entry) return undefined
  if (typeof entry === 'function') {
    const { baseType: type, subtypes } = parseUnitLocator(key)
    for (let i = 0; i < subtypes.length; i++) {
      const parentSubs = [...subtypes.slice(0, i), ...subtypes.slice(i + 1)]
      const parentKey =
        parentSubs.length > 0 ? makeVariantId(type, parentSubs) : type
      const parentStats = resolveUnitStats(unitStats, parentKey)
      if (parentStats !== undefined) {
        return entry(parentStats)
      }
    }
    const baseEntry = unitStats[type]
    if (baseEntry !== undefined && typeof baseEntry !== 'function') {
      return entry(baseEntry)
    }
    return undefined
  }
  return entry
}
