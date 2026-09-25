import type { UnitBaseType, UnitType } from '@/types'

import type { HitSource, SideStateData } from '../../combat-state/types'
import { parseUnitLocator } from '../../utils/parse-unit-locator'
import { resolveUnitStats } from '../../utils/resolve-unit-stats'
import type { HitValueModifierDecl, SideDiceCollection } from '../types'

/** Apply stored hit-value modifiers (queued by BEFORE-timing abilities) to
 *  a side's `SideDiceCollection`, mutating in place. Handles both bulk
 *  variant-wide modifiers and `singleUnit` modifiers that split one unit
 *  out of its bucket. */
export function applyStoredHitValueModifiers(
  collection: SideDiceCollection,
  modifiers: readonly HitValueModifierDecl[],
  unitStats: SideStateData['unitStats'],
  hitSource: HitSource,
): void {
  for (const mod of modifiers) {
    if (mod.singleUnit) {
      // Split one unit out of the entry that matches the variant's
      // natural dpu under `singleUnit`'s base type. Resolving stats by
      // the full variant key lets a subtyped unit (e.g. CRUISER:Cavalry
      // with bonus dice) target its own entry instead of the plain
      // CRUISER entry sharing the base bucket. Fall back to the first
      // entry when stats don't disambiguate.
      const variantKey = mod.singleUnit as UnitType
      const baseType = parseUnitLocator(variantKey).baseType as UnitBaseType
      const entries = collection[baseType]
      if (!entries || entries.length === 0) continue
      const stats = resolveUnitStats(unitStats, variantKey)
      const dieData =
        hitSource === 'COMBAT'
          ? stats?.COMBAT
          : stats?.UNIT_ABILITIES?.[hitSource]
      const naturalDpu = dieData ? dieData[1] + (dieData[2] ?? 0) : undefined
      const sourceIdx =
        naturalDpu !== undefined
          ? entries.findIndex(e => e[2] === naturalDpu)
          : 0
      const idx = sourceIdx >= 0 ? sourceIdx : 0
      const source = entries[idx]
      const [count, hv, dpu] = source
      const newHv = Math.max(1, hv + mod.amount)
      if (count > 1) source[0] = count - 1
      else entries.splice(idx, 1)
      const merge = entries.find(e => e[1] === newHv && e[2] === dpu)
      if (merge) merge[0] += 1
      else entries.push([1, newHv, dpu])
      continue
    }
    for (const variant of Object.keys(collection) as UnitBaseType[]) {
      if (mod.unitType && variant !== mod.unitType) continue
      if (mod.excludeUnitTypes?.includes(variant)) continue
      const entries = collection[variant]
      if (!entries) continue
      const next: [number, number, number][] = []
      for (const [count, hv, dpu] of entries) {
        const newHv = Math.max(1, hv + mod.amount)
        const merge = next.find(e => e[1] === newHv && e[2] === dpu)
        if (merge) merge[0] += count
        else next.push([count, newHv, dpu])
      }
      collection[variant] = next
    }
  }
}
