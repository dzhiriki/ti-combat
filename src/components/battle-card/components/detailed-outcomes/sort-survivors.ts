import type { SurvivorSide } from '@/combat'
import { parseUnitLocator } from '@/combat/utils/parse-unit-locator'
import { unitLocatorRank } from '@/combat/utils/unit-locator'
import type { SurfaceId, UnitType } from '@/types'

export interface SurvivorEntry {
  variantKey: string
  base: string
  subtypes?: string[]
  healthy: number
  damaged: number
}

export function sortSurvivors(
  side: SurvivorSide,
  priority: readonly string[],
  surfaceId?: SurfaceId,
): SurvivorEntry[] {
  const entries: SurvivorEntry[] = []

  for (const [base, units] of Object.entries(side)) {
    if (!units || units.length === 0) continue
    const groups = new Map<string, { healthy: number; damaged: number }>()
    for (const u of units) {
      const subKey = u.subtypes?.join(',') ?? ''
      const g = groups.get(subKey) ?? { healthy: 0, damaged: 0 }
      if (u.isDamaged) g.damaged++
      else g.healthy++
      groups.set(subKey, g)
    }
    for (const [subKey, counts] of groups) {
      const variantKey = subKey ? `${base}:${subKey}` : base
      entries.push({
        variantKey,
        base,
        subtypes: subKey ? subKey.split(',') : undefined,
        healthy: counts.healthy,
        damaged: counts.damaged,
      })
    }
  }

  const rank = new Map<string, number>()
  priority.forEach((key, index) => {
    // Without a surface, qualified duplicates collapse to one type; the
    // earliest entry ranks it.
    const rankKey =
      surfaceId === undefined ? parseUnitLocator(key).unitType : key
    if (!rank.has(rankKey)) rank.set(rankKey, index)
  })
  const rankOf = (entry: SurvivorEntry): number => {
    const value = unitLocatorRank(rank, entry.variantKey as UnitType, surfaceId)
    return value === Infinity ? -1 : value
  }

  entries.sort((a, b) => rankOf(b) - rankOf(a))
  return entries
}
