import type { UnitId, UnitState, UnitType } from '@/types'

import type { SideStateData } from '../combat-state/types'
import { stateDestroyScore } from './state-destroy-score'

/**
 * Canonicalize per-variant state assignments by permuting `unitState`
 * VALUES across UnitIds. Within each variant pool, lowest UnitId ends
 * up owning the worst-state value (highest destroyScore); highest
 * UnitId owns the best (clean) value.
 *
 * The bijection direction matches `participatingUnits`'s tie-break
 * (lower IDs at the tail), so tail-slice ASSIGN_HITS picks the
 * worst-state owner without a state-aware secondary sort.
 *
 * Sparse-map convention: a `{}`-equivalent state (destroyScore=0) is
 * stored as a missing entry rather than `{ isDamaged: false, ... }` —
 * matches how `getUnitsHash` filters falsy fields and keeps the in-memory
 * representation aligned with the hash.
 *
 * Mutates `s.unitState` in place. Caller must invoke
 * `ensureUnitStateOwned` first if CoW protection is needed.
 */
export function canonicalizeUnitState(
  s: SideStateData,
  types?: ReadonlySet<UnitType>,
): void {
  s._needsCanonicalize = undefined
  const pools = collectVariantPools(s, types)
  for (const ids of pools.values()) canonicalizePool(s, ids)
}

function collectVariantPools(
  s: SideStateData,
  types?: ReadonlySet<UnitType>,
): Map<string, UnitId[]> {
  const pools = new Map<string, UnitId[]>()
  const collect = (pool: string) => {
    for (const id of pool) {
      const type = s.unitType[id]
      if (!type) continue
      if (types && !types.has(type)) continue
      const key = `${s.unitSurface[id] ?? ''}\0${type}`
      const pool = pools.get(key)
      if (pool) pool.push(id as UnitId)
      else pools.set(key, [id as UnitId])
    }
  }
  collect(s.participatingUnits)
  collect(s.nonParticipatingUnits)
  return pools
}

function canonicalizePool(s: SideStateData, ids: UnitId[]): void {
  if (ids.length <= 1) return

  // Collect non-zero state values only. Score-0 states (`{}`,
  // `{ isDamaged: false }`, etc.) are equivalent for hash and
  // assign-hits purposes, and forcing them to swap across IDs would
  // disturb mid-step identity that abilities like Direct Hit and
  // Dynamo+MVS rely on. So they're left attached to their current IDs.
  const nonZero: UnitState[] = []
  for (const id of ids) {
    const state = s.unitState[id]
    if (state && stateDestroyScore(state) > 0) nonZero.push(state)
  }
  if (nonZero.length === 0) return

  // Sort non-zero states asc by destroyScore (stable). Worst score
  // lands at the array tail.
  nonZero.sort((a, b) => stateDestroyScore(a) - stateDestroyScore(b))

  // Pair the K worst states with the K lowest pool-IDs (lowest id ↔
  // tail-slot worst, second-lowest ↔ second-worst, etc.). Other IDs
  // get cleared (so the prior owner doesn't keep a stale entry).
  ids.sort()
  for (let i = 0; i < nonZero.length; i++) {
    s.unitState[ids[i]] = nonZero[nonZero.length - 1 - i]
  }
  for (let i = nonZero.length; i < ids.length; i++) {
    delete s.unitState[ids[i]]
  }
}
