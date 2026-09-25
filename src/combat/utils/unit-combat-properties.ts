import { UNIT_CATEGORIES, type UnitCategory } from '@/constants/units'
import type { UnitId, UnitType } from '@/types'

import type {
  CombatMode,
  SideStateData,
  UnitTargetFilter,
} from '../combat-state/types'
import { parseUnitLocator } from './parse-unit-locator'
import { resolveUnitStats } from './resolve-unit-stats'
import { matchesUnitLocator } from './unit-locator'

export function isNativeCategory(
  side: SideStateData,
  type: UnitType,
  category: UnitCategory,
): boolean {
  const base = parseUnitLocator(type).baseType
  const categories = resolveUnitStats(side.unitStats, type)?.CATEGORIES
  return categories
    ? categories.includes(category)
    : UNIT_CATEGORIES[category].includes(base)
}

/** Also works for destroyed ids, whose metadata is retained for reactions. */
export function isUnitCategory(
  side: SideStateData,
  id: string,
  category: UnitCategory,
): boolean {
  const type = side.unitType[id]
  if (!type) return false
  return (
    side.unitCombat?.[id]?.categories?.[category] ??
    isNativeCategory(side, type, category)
  )
}

export function participatesInCombat(
  side: SideStateData,
  id: string,
  mode: CombatMode,
  activeSurfaceId: string,
): boolean {
  const explicit = side.unitCombat?.[id]?.participating
  if (explicit !== undefined) return explicit
  const type = side.unitType[id]
  if (!type) return false
  return (
    side.unitSurface[id] === activeSurfaceId &&
    isNativeCategory(side, type, mode === 'SPACE' ? 'SHIPS' : 'GROUND_FORCES')
  )
}

export function matchesTargetFilter(
  side: SideStateData,
  id: UnitId,
  filter?: UnitTargetFilter,
): boolean {
  if (!filter) return true
  const type = side.unitType[id]
  if (!type) return false
  if (
    filter.types &&
    !filter.types.some(t => matchesUnitLocator(side, id, t, true))
  )
    return false
  if (filter.excludeTypes?.some(t => matchesUnitLocator(side, id, t, true)))
    return false
  if (
    filter.unitAbility &&
    resolveUnitStats(side.unitStats, type)?.UNIT_ABILITY_HIT_IMMUNE
  )
    return false
  return true
}

/** Stable signature also distinguishes explicit defaults from inherited ones. */
export function unitCombatSignature(side: SideStateData, id: string): string {
  const value = side.unitCombat?.[id]
  if (!value) return ''
  return `${value.participating ?? ''}:${value.returnAfterCombat ?? ''}:${JSON.stringify(Object.entries(value.categories ?? {}).sort(([a], [b]) => a.localeCompare(b)))}`
}

const categoryHashes = new WeakMap<SideStateData['unitStats'], string>()
const overrideHashes = new WeakMap<
  NonNullable<SideStateData['unitCombat']>,
  string
>()

/** State-hash segment for native categories and instance grants: '' when
 *  neither is present, else `#native&explicit`. Cached on the side with
 *  the two copy-on-write inputs it was built from, so the hot path is two
 *  reference checks and branch clones share the entry. */
export function unitCombatHash(side: SideStateData): string {
  const cached = side._unitCombatHash
  if (
    cached !== undefined &&
    cached.unitStats === side.unitStats &&
    cached.unitCombat === side.unitCombat
  ) {
    return cached.value
  }
  const value = buildUnitCombatHash(side)
  side._unitCombatHash = {
    unitStats: side.unitStats,
    unitCombat: side.unitCombat,
    value,
  }
  return value
}

function buildUnitCombatHash(side: SideStateData): string {
  let native = categoryHashes.get(side.unitStats)
  if (native === undefined) {
    native = Object.keys(side.unitStats)
      .sort()
      .flatMap(key => {
        const stats = resolveUnitStats(side.unitStats, key as UnitType)
        return stats?.CATEGORIES || stats?.UNIT_ABILITY_HIT_IMMUNE
          ? [
              `${key}:${[...(stats.CATEGORIES ?? [])].sort().join(',')}:${!!stats.UNIT_ABILITY_HIT_IMMUNE}`,
            ]
          : []
      })
      .join(';')
    categoryHashes.set(side.unitStats, native)
  }
  const overrides = side.unitCombat
  if (!overrides) return native ? `#${native}&` : ''
  let explicit = overrideHashes.get(overrides)
  if (explicit === undefined) {
    explicit = Object.keys(overrides)
      .sort()
      .map(id => `${id}:${unitCombatSignature(side, id)}`)
      .join(';')
    overrideHashes.set(overrides, explicit)
  }
  // An empty grant map behaves exactly like none, so both hash as ''.
  return native || explicit ? `#${native}&${explicit}` : ''
}
