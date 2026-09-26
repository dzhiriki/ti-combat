import { UNIT_CATEGORIES, type UnitCategory } from '@/constants/units'
import type { SurfaceId, UnitId, UnitLocator, UnitType } from '@/types'

import type { CombatMode, SideStateData } from '../combat-state/types'
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
    side.unitGrants?.[id] === category || isNativeCategory(side, type, category)
  )
}

export function participatesInCombat(
  side: SideStateData,
  id: string,
  mode: CombatMode,
  activeSurfaceId: string,
): boolean {
  const type = side.unitType[id]
  if (!type) return false
  const category = mode === 'SPACE' ? 'SHIPS' : 'GROUND_FORCES'
  return (
    side.unitGrants?.[id] === category ||
    (side.unitSurface[id] === activeSurfaceId &&
      isNativeCategory(side, type, category))
  )
}

/** Whether `id` may take a hit from a pool restricted to `targets`
 *  (`HitPool.unitAbilityTargets`); any unit may when there are none. */
export function isUnitAbilityTarget(
  side: SideStateData,
  id: UnitId,
  targets: readonly UnitLocator[] | undefined,
): boolean {
  if (!targets) return true
  const type = side.unitType[id]
  return (
    !!type &&
    targets.some(t => matchesUnitLocator(side, id, t, true)) &&
    !resolveUnitStats(side.unitStats, type)?.UNIT_ABILITY_HIT_IMMUNE
  )
}

const categoryHashes = new WeakMap<SideStateData['unitStats'], string>()

/** State-hash segment for unit location, native categories and instance
 *  grants: '' when every unit (destroyed ones included) stands on the active
 *  surface and none of the others apply. Cached on the side with the
 *  copy-on-write inputs it was built from, so the hot path is a few
 *  reference checks and branch clones share the entry. */
export function unitMetaHash(
  side: SideStateData,
  activeSurfaceId: SurfaceId,
): string {
  const cached = side._metaHash
  if (
    cached !== undefined &&
    cached.unitSurface === side.unitSurface &&
    cached.unitStats === side.unitStats &&
    cached.unitGrants === side.unitGrants &&
    cached.activeSurfaceId === activeSurfaceId
  ) {
    return cached.value
  }
  const value =
    locationHash(side.unitSurface, activeSurfaceId) + categoryHash(side)
  side._metaHash = {
    unitSurface: side.unitSurface,
    unitStats: side.unitStats,
    unitGrants: side.unitGrants,
    activeSurfaceId,
    value,
  }
  return value
}

/** `@surface=ids,…` for every unit off the active surface, else ''. */
function locationHash(
  unitSurface: SideStateData['unitSurface'],
  activeSurfaceId: SurfaceId,
): string {
  const bySurface: Record<string, string[]> = {}
  for (const id in unitSurface) {
    const surfaceId = unitSurface[id]
    if (surfaceId !== activeSurfaceId) (bySurface[surfaceId] ??= []).push(id)
  }
  let hash = ''
  for (const surfaceId of Object.keys(bySurface).sort()) {
    hash += `${surfaceId}=${bySurface[surfaceId].sort().join('')},`
  }
  return hash && `@${hash}`
}

/** `#native&grants` when a stats entry declares categories (or hit
 *  immunity) or a unit holds a grant, else ''. */
function categoryHash(side: SideStateData): string {
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
  let grants = ''
  if (side.unitGrants) {
    for (const id of Object.keys(side.unitGrants).sort())
      grants += `${id}${side.unitGrants[id]};`
  }
  return native || grants ? `#${native}&${grants}` : ''
}
