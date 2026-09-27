import { UNIT_CATEGORIES, type UnitCategory } from '@/constants/units'
import type {
  CategoryEntry,
  PhaseCategory,
  SurfaceId,
  UnitId,
  UnitLocator,
  UnitType,
} from '@/types'

import type {
  CombatMode,
  MetaPhase,
  SideStateData,
} from '../combat-state/types'
import { parseUnitLocator } from './parse-unit-locator'
import { resolveUnitStats } from './resolve-unit-stats'
import { matchesUnitLocator } from './unit-locator'

const phasesOf = (entry: PhaseCategory): readonly MetaPhase[] =>
  typeof entry.phase === 'string' ? [entry.phase] : entry.phase

/** Whether `entry` is `category` during `phase`: plain entries always,
 *  phase-scoped ones only while `phase` is one of theirs. */
function holdsCategory(
  entry: CategoryEntry,
  category: UnitCategory,
  phase: MetaPhase | undefined,
): boolean {
  if (typeof entry === 'string') return entry === category
  return (
    entry.category === category &&
    phase !== undefined &&
    phasesOf(entry).includes(phase)
  )
}

/** Native membership of `type` during `phase` (the scheduler's meta).
 *  Phase-scoped entries never apply without one: setup and PREPARE. */
export function isNativeCategory(
  side: SideStateData,
  type: UnitType,
  category: UnitCategory,
  phase?: MetaPhase,
): boolean {
  const categories = resolveUnitStats(side.unitStats, type)?.CATEGORIES
  return categories
    ? categories.some(entry => holdsCategory(entry, category, phase))
    : UNIT_CATEGORIES[category].includes(parseUnitLocator(type).baseType)
}

const phaseCategoryStats = new WeakMap<SideStateData['unitStats'], boolean>()

/** Whether any of the side's stats has a phase-scoped entry, so membership
 *  can change between metas. Cached per copy-on-write stats object. */
export function hasPhaseCategories(side: SideStateData): boolean {
  let value = phaseCategoryStats.get(side.unitStats)
  if (value === undefined) {
    value = Object.keys(side.unitStats).some(key =>
      resolveUnitStats(side.unitStats, key as UnitType)?.CATEGORIES?.some(
        entry => typeof entry !== 'string',
      ),
    )
    phaseCategoryStats.set(side.unitStats, value)
  }
  return value
}

/** Also works for destroyed ids, whose metadata is retained for reactions. */
export function isUnitCategory(
  side: SideStateData,
  id: string,
  category: UnitCategory,
  phase?: MetaPhase,
): boolean {
  const type = side.unitType[id]
  if (!type) return false
  return (
    side.unitGrants?.[id] === category ||
    isNativeCategory(side, type, category, phase)
  )
}

/** Ships fight a space combat wherever they stand in the system; ground
 *  forces fight a ground combat only on the invaded planet (the attacker's
 *  land there when committed). */
function fightsFrom(
  surfaceId: string,
  mode: CombatMode,
  activeSurfaceId: string,
): boolean {
  return mode === 'SPACE' || surfaceId === activeSurfaceId
}

/** Whether a new unit of `type` on `surfaceId` takes part: a native member of
 *  the mode's category where that mode fights. */
export function participatesNatively(
  side: SideStateData,
  type: UnitType,
  surfaceId: string,
  mode: CombatMode,
  activeSurfaceId: string,
  phase: MetaPhase | undefined,
): boolean {
  return (
    fightsFrom(surfaceId, mode, activeSurfaceId) &&
    isNativeCategory(
      side,
      type,
      mode === 'SPACE' ? 'SHIPS' : 'GROUND_FORCES',
      phase,
    )
  )
}

/** Membership in the mode's category (native for the current meta, or
 *  granted) where that mode fights. */
export function participatesInCombat(
  side: SideStateData,
  id: string,
  mode: CombatMode,
  activeSurfaceId: string,
  phase: MetaPhase | undefined,
): boolean {
  return (
    fightsFrom(side.unitSurface[id], mode, activeSurfaceId) &&
    isUnitCategory(
      side,
      id,
      mode === 'SPACE' ? 'SHIPS' : 'GROUND_FORCES',
      phase,
    )
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

const categoryKey = (entry: CategoryEntry): string =>
  typeof entry === 'string'
    ? entry
    : `${entry.category}/${[...phasesOf(entry)].sort().join('/')}`

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
              `${key}:${(stats.CATEGORIES ?? []).map(categoryKey).sort().join(',')}:${!!stats.UNIT_ABILITY_HIT_IMMUNE}`,
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
