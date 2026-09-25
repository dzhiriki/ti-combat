import type { UnitId, UnitIdList, UnitLocator } from '@/types'

import type { SideStateData } from '../combat-state/types'
import { unitLocatorRank } from './unit-locator'

/**
 * Splits `side.participatingUnits` and `side.nonParticipatingUnits`:
 *
 * - Membership comes from `participatingUnit`, independently of priority.
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
 * Replaces both packed id lists without changing locations or unit types.
 */
export function sortUnitsByPriority(
  side: SideStateData,
  priorityList: readonly UnitLocator[],
  participatingUnit: (id: UnitId) => boolean,
): void {
  const rank = new Map<string, number>()
  for (let i = 0; i < priorityList.length; i++) {
    rank.set(priorityList[i], i)
  }

  const participating: UnitId[] = []
  const nonParticipating: UnitId[] = []
  const seed = (pool: UnitIdList) => {
    for (const id of pool) {
      const unitId = id as UnitId
      if (participatingUnit(unitId)) participating.push(unitId)
      else nonParticipating.push(unitId)
    }
  }
  seed(side.participatingUnits)
  seed(side.nonParticipatingUnits)

  const rankOf = new Map<UnitId, number>()
  for (const id of participating)
    rankOf.set(
      id,
      unitLocatorRank(rank, side.unitType[id], side.unitSurface[id]),
    )
  participating.sort((a, b) => {
    const ra = rankOf.get(a)!
    const rb = rankOf.get(b)!
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
  // Location signatures are per id list, so any membership change voids
  // them — except '' (everything on the active surface).
  if (side._locationHash) side._locationHash = undefined
}
