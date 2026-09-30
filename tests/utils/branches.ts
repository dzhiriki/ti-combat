import type { StateWithProbability } from '@/combat'
import { parseUnitLocator } from '@/combat/utils/parse-unit-locator'
import type { CombatSide, UnitBaseType } from '@/types'

/** Combine multiple branch extractors into one that returns a tuple of their
 *  per-branch values. Pair with `toHaveBranches` to group by a composite key:
 *
 *    toHaveBranches(
 *      all(pendingHits('defender'), currentUses('attacker', 'KEY')),
 *      [{ value: [0, 3], probability: 0.0625 }],
 *    )
 *
 *  The matcher compares tuple values structurally (element-wise). */
export function all<T extends readonly unknown[]>(
  ...extractors: { [K in keyof T]: (branch: StateWithProbability) => T[K] }
): (branch: StateWithProbability) => T {
  return branch => extractors.map(fn => fn(branch)) as unknown as T
}

/** Total pending hits for `side` across all pools in a branch. Curried so
 *  callers can pass it directly as a `toHaveBranches` extractor:
 *  `expect(branches).toHaveBranches(pendingHits('defender'), [...])`. */
export function pendingHits(
  side: CombatSide,
): (branch: StateWithProbability) => number {
  return branch => {
    const pool = branch.state.data[side].hitPool
    if (pool === undefined) return 0
    let n = pool.base + pool.additional
    for (const c of pool.custom) n += c.base
    return n
  }
}

/** All branches where `side` is taking exactly `amount` pending hits. */
export function branchesByHit(
  branches: StateWithProbability[],
  side: CombatSide,
  amount: number,
): StateWithProbability[] {
  const get = pendingHits(side)
  return branches.filter(b => get(b) === amount)
}

/** Sum of probabilities across the given branches. */
export function sumProb(branches: StateWithProbability[]): number {
  return branches.reduce((s, b) => s + b.probability, 0)
}

/** Live (overlay) `uses` for a side's ability on this branch, or undefined
 *  when the overlay hasn't touched it. Use this to assert "did this branch
 *  touch the use counter". For "effective uses on this branch" prefer
 *  `currentUses` which merges base + live. */
export function liveUses(
  branch: StateWithProbability,
  side: CombatSide,
  abilityKey: string,
): number | undefined {
  const live = branch.state.data[side].liveAbilities[abilityKey]
  const uses = live?.uses
  return typeof uses === 'number' ? uses : undefined
}

/** Effective `uses` on this branch — live overlay if present, otherwise
 *  base config. Use this when an ability starts with >1 uses and you want
 *  to assert exact remaining count regardless of overlay presence. Curried
 *  so callers can pass it directly as a `toHaveBranches` extractor:
 *  `expect(branches).toHaveBranches(currentUses('attacker', 'KEY'), [...])`. */
export function currentUses(
  side: CombatSide,
  abilityKey: string,
): (branch: StateWithProbability) => number | undefined {
  return branch => {
    const sideData = branch.state.data[side]
    const live = sideData.liveAbilities[abilityKey]?.uses
    if (typeof live === 'number') return live
    const base = sideData.abilities[abilityKey]?.uses
    return typeof base === 'number' ? base : undefined
  }
}

/** Count of surviving units of the given base type on `side` (matches both
 *  the plain variant key and any subtypes, e.g. `'DREADNOUGHT:Cavalry'`).
 *  Curried so callers can pass it directly as a `toHaveBranches` extractor:
 *  `expect(branches).toHaveBranches(unitCount('attacker', 'FLAGSHIP'), [...])`. */
export function unitCount(
  side: CombatSide,
  baseType: UnitBaseType,
): (branch: StateWithProbability) => number {
  return branch => {
    const s = branch.state.data[side]
    let n = 0
    for (const id of s.participatingUnits) {
      const variantKey = s.unitType[id as string]
      if (variantKey && parseUnitLocator(variantKey).baseType === baseType) n++
    }
    for (const id of s.nonParticipatingUnits) {
      const variantKey = s.unitType[id as string]
      if (variantKey && parseUnitLocator(variantKey).baseType === baseType) n++
    }
    return n
  }
}
