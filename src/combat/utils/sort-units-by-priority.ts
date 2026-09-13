import type { UnitBaseType, UnitId, UnitIdList, UnitType } from '@/types'

import type { SideStateData } from '../combat-state/types'
import { parseVariantId } from './unit-variant'

/**
 * Splits `side.participatingUnits` and `side.nonParticipatingUnits`:
 *
 * - An id is participating when its base type is in
 *   `participatingTypes` (the authoritative "is this unit in combat"
 *   set derived from SETTINGS).
 * - Participating ids are sorted so that `priorityList[0]` lands at
 *   the TAIL (tail-slice assign-hits kills the tail first, and
 *   `priorityList[0]` is the first variant to be sacrificed). Ids
 *   whose variant is not in `priorityList` still participate — they
 *   sort after any ranked ids (higher priority), i.e. they sit at the
 *   head and die last under tail-slice.
 *
 * Subtyped variants fall back to their base type's rank when the
 * priority list contains only the base (e.g. `CRUISER` ranks
 * `CRUISER:Cavalry` too).
 *
 * Mutates both arrays (replaces with fresh arrays). `side.unitType`
 * is not modified.
 */
export function sortUnitsByPriority(
  side: SideStateData,
  priorityList: readonly UnitType[],
  participatingTypes?: ReadonlySet<UnitBaseType>,
  participatingUnit?: (id: UnitId) => boolean,
): void {
  const rank = new Map<UnitType, number>()
  for (let i = 0; i < priorityList.length; i++) {
    rank.set(priorityList[i], i)
  }

  const rankOf = (key: UnitType): number => {
    const exact = rank.get(key)
    if (exact !== undefined) return exact
    const base = parseVariantId(key).type as UnitType
    const baseRank = rank.get(base)
    if (baseRank !== undefined) return baseRank
    // Unranked variants sort as "higher priority than anything ranked"
    // (die last). Using -1 places them below index 0 in the ra-rb sort.
    return -1
  }

  const participates = (id: UnitId): boolean => {
    if (participatingUnit) return participatingUnit(id)
    if (participatingTypes) {
      const base = parseVariantId(side.unitType[id]).type as UnitBaseType
      return participatingTypes.has(base)
    }
    return rankOf(side.unitType[id]) !== -1
  }

  const participating: UnitId[] = []
  const nonParticipating: UnitId[] = []
  const seed = (pool: UnitIdList) => {
    for (const id of pool) {
      const unitId = id as UnitId
      if (participates(unitId)) participating.push(unitId)
      else nonParticipating.push(unitId)
    }
  }
  seed(side.participatingUnits)
  seed(side.nonParticipatingUnits)

  participating.sort((a, b) => {
    const ra = rankOf(side.unitType[a])
    const rb = rankOf(side.unitType[b])
    // Highest rank first so the LOWEST rank (priorityList[0], first to
    // be sacrificed) lands at the tail — tail-slice destroys it first.
    if (ra !== rb) return rb - ra
    // Within a rank tier: UnitId descending — lower IDs at the tail.
    // `canonicalizeUnitState` permutes UnitState VALUES so the lowest
    // pool-ID owns the worst-state value; tail-slice therefore picks
    // the worst state without a state-aware tie-break here.
    return a > b ? -1 : a < b ? 1 : 0
  })

  side.participatingUnits = participating.join('') as UnitIdList
  side.nonParticipatingUnits = nonParticipating.join('') as UnitIdList
  if (side._locationHash && !side._locationHash.startsWith('='))
    side._locationHash = undefined
}
