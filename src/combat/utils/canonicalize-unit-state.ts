import type { UnitId, UnitState, UnitType } from '@/types'

import type { SideStateData } from '../combat-state/types'
import { stateDestroyScore } from './state-destroy-score'

/**
 * Canonicalize per-variant state assignments by permuting `unitState`
 * VALUES across UnitIds with the same variant, surface, and combat grants.
 * Within each equivalent pool, lowest UnitId ends
 * up owning the worst-state value (highest destroyScore); highest
 * UnitId owns the best (clean) value.
 *
 * The bijection direction matches `participatingUnits`'s tie-break
 * (lower IDs at the tail), so tail-slice ASSIGN_HITS picks the
 * worst-state owner without a state-aware secondary sort.
 *
 * Sparse-map convention: a `{}`-equivalent state (destroyScore=0) is
 * stored as a missing entry rather than `{ isDamaged: false, ... }`.
 * `getUnitsHash` distinguishes an entry from no entry, so keeping the map
 * canonical is what lets equivalent states hash equal.
 *
 * Owns the state map before permutation so sibling branches are isolated.
 */
export function canonicalizeUnitState(
  s: SideStateData,
  types?: ReadonlySet<UnitType>,
): void {
  s._needsCanonicalize = undefined
  if (s._unitStateShared) {
    s.unitState = { ...s.unitState }
    s._unitStateShared = false
  }
  for (const ids of collectVariantPools(s, types)) canonicalizePool(s, ids)
}

function collectVariantPools(
  s: SideStateData,
  types?: ReadonlySet<UnitType>,
): UnitId[][] {
  const pools: UnitId[][] = []
  // Participating and non-participating units never share a pool.
  const collect = (list: string) => {
    const byType = new Map<UnitType, UnitId[]>()
    for (const id of list) {
      const type = s.unitType[id]
      if (!type) continue
      if (types && !types.has(type)) continue
      const ids = byType.get(type)
      if (ids) ids.push(id as UnitId)
      else byType.set(type, [id as UnitId])
    }
    for (const ids of byType.values()) splitByPlacement(s, ids, pools)
  }
  collect(s.participatingUnits)
  collect(s.nonParticipatingUnits)
  return pools
}

/** Split one variant's ids by surface and combat grants. They usually all
 *  match, so per-unit keys are only built when they actually differ. */
function splitByPlacement(
  s: SideStateData,
  ids: UnitId[],
  pools: UnitId[][],
): void {
  if (ids.length <= 1) return
  const surface = s.unitSurface[ids[0]]
  const grant = s.unitGrants?.[ids[0]]
  if (
    ids.every(
      id => s.unitSurface[id] === surface && s.unitGrants?.[id] === grant,
    )
  ) {
    pools.push(ids)
    return
  }
  const groups = new Map<string, UnitId[]>()
  for (const id of ids) {
    const key = `${s.unitSurface[id] ?? ''}\0${s.unitGrants?.[id] ?? ''}`
    const group = groups.get(key)
    if (group) group.push(id)
    else groups.set(key, [id])
  }
  for (const group of groups.values()) pools.push(group)
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
