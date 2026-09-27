import type { UnitBaseType } from '@/types'

import type { HitValueModifierDecl, SideDiceCollection } from '../types'

/** Apply stored hit-value modifiers (queued by BEFORE-timing abilities) to
 *  a side's `SideDiceCollection`, mutating in place. */
export function applyStoredHitValueModifiers(
  collection: SideDiceCollection,
  modifiers: readonly HitValueModifierDecl[],
): void {
  for (const mod of modifiers) {
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
