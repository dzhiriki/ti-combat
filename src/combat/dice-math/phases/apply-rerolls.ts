import type { UnitType } from '@/types'

import { parseVariantId } from '../../utils/unit-variant'
import type { HitsDist, RerollSide } from '../reroll-strategy'
import type { FlatSource, RerollTargetSpec, Source } from '../types'
import { binomial, hitProb } from '../utils/get-dice-distribution'

/** Per-source hits map carried through reroll passes. Sources missing from
 *  the record produced no dice. */
export type PerSourceHits = Record<Source, number>

/** Total hits across all sources in a per-source hits map. */
function totalHits(hits: PerSourceHits): number {
  let t = 0
  for (const s of Object.keys(hits)) t += hits[s]
  return t
}

/** Marginal `(hits, probability)` distribution over total hits, summed
 *  across a list of branches. Branches must carry a `hits` map and
 *  `probability`. */
function marginalize<B extends { hits: PerSourceHits; probability: number }>(
  branches: readonly B[],
): HitsDist {
  const totals = new Map<number, number>()
  for (const b of branches) {
    const t = totalHits(b.hits)
    totals.set(t, (totals.get(t) ?? 0) + b.probability)
  }
  return Array.from(totals.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([hits, probability]) => ({ hits, probability }))
}

/** Evaluate a REROLL spec's `rerollIf` gate against a side total +
 *  pre-reroll marginal. No predicate ⇒ always fires. */
function fires(
  rerollIf: ((side: RerollSide) => boolean) | undefined,
  total: number,
  distribution: HitsDist,
): boolean {
  if (!rerollIf) return true
  return rerollIf({ total, distribution })
}

/** Does a source match a REROLL spec's `units` filter? The filter may name
 *  variant keys (`MECH:Galvanized`) or base types (`MECH`) — same matching as
 *  ROLL_TRIGGER's source filter. */
function sourceMatches(
  source: Source,
  sourceMap: Record<Source, FlatSource>,
  units: UnitType[],
): boolean {
  const key = sourceMap[source]?.variant
  if (key === undefined) return false
  if (units.includes(key)) return true
  return units.includes(parseVariantId(key).type as UnitType)
}

/** Number of dice a spec would reroll on the sources it matches — used to
 *  gate scoped rerolls per branch (nothing to reroll ⇒ not fired, no use
 *  billed). */
function rerollableDice(
  hits: PerSourceHits,
  sourceMap: Record<Source, FlatSource>,
  spec: RerollTargetSpec,
): number {
  let count = 0
  for (const source of Object.keys(hits)) {
    if (spec.units && !sourceMatches(source, sourceMap, spec.units)) continue
    const info = sourceMap[source]
    const k = hits[source]
    const totalDice = info.unitCount * info.dicePerUnit
    count +=
      spec.target === 'ALL'
        ? totalDice
        : spec.target === 'MISSES'
          ? totalDice - k
          : k
  }
  return count
}

function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  let r = 1
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1)
  return r
}

/** Enumerate every ordered per-unit hit split `(h_1..h_N)` of `k` total hits
 *  across `N` units rolling `d` dice each. Dice are i.i.d., so conditioned on
 *  the total the assignment is uniform — each split's weight is the
 *  multivariate hypergeometric `Π C(d, h_i) / C(N·d, k)`. */
function enumerateUnitSplits(
  N: number,
  d: number,
  k: number,
): { units: number[]; weight: number }[] {
  const denom = choose(N * d, k)
  const out: { units: number[]; weight: number }[] = []
  const recurse = (
    unit: number,
    remaining: number,
    acc: number[],
    w: number,
  ) => {
    if (unit === N) {
      if (remaining === 0) out.push({ units: [...acc], weight: w / denom })
      return
    }
    const maxHere = Math.min(d, remaining)
    // Remaining units must be able to absorb what's left.
    const minHere = Math.max(0, remaining - (N - unit - 1) * d)
    for (let h = minHere; h <= maxHere; h++) {
      acc.push(h)
      recurse(unit + 1, remaining - h, acc, w * choose(d, h))
      acc.pop()
    }
  }
  recurse(0, k, [], 1)
  return out
}

/** Per-UNIT reroll (spec.perUnit + spec.units): expand each matched source's
 *  total hits into per-unit splits, spend 1 use per unit whose eligible dice
 *  count is ≥ the threshold (most-eligible-first, capped by the remaining
 *  budget), and reroll the spent units' eligible dice. Sources process
 *  sequentially sharing the budget. Returns every outcome with its
 *  probability factor and the uses consumed, or `null` when the spec cannot
 *  fire at all (no budget / no matched source). */
function perUnitRerollOutcomes(
  hits: PerSourceHits,
  sourceMap: Record<Source, FlatSource>,
  spec: RerollTargetSpec,
): { hits: PerSourceHits; factor: number; consumed: number }[] | null {
  const threshold = spec.perUnit!.threshold
  const budget = spec.limit ?? Infinity
  if (budget <= 0) return null
  const matched = Object.keys(hits).filter(s =>
    sourceMatches(s, sourceMap, spec.units!),
  )
  if (matched.length === 0) return null

  let outcomes: { hits: PerSourceHits; factor: number; consumed: number }[] = [
    { hits: { ...hits }, factor: 1, consumed: 0 },
  ]
  for (const source of matched) {
    const info = sourceMap[source]
    const k = hits[source]
    const d = info.dicePerUnit
    const p = hitProb(info.hitValue)
    const splits = enumerateUnitSplits(info.unitCount, d, k)
    const next: typeof outcomes = []
    for (const cur of outcomes) {
      const remaining = budget - cur.consumed
      for (const split of splits) {
        const perUnit = split.units.map(h => ({
          h,
          eligible:
            spec.target === 'ALL' ? d : spec.target === 'MISSES' ? d - h : h,
        }))
        const qualifying = perUnit
          .filter(u => u.eligible >= threshold)
          .sort((a, b) => b.eligible - a.eligible)
        const spent = qualifying.slice(
          0,
          Math.min(qualifying.length, remaining),
        )
        if (spent.length === 0) {
          next.push({
            hits: cur.hits,
            factor: cur.factor * split.weight,
            consumed: cur.consumed,
          })
          continue
        }
        const rerolledDice = spent.reduce((s, u) => s + u.eligible, 0)
        const keptHits =
          spec.target === 'MISSES' ? k : k - spent.reduce((s, u) => s + u.h, 0)
        const pmf = binomial(rerolledDice, p)
        for (let m = 0; m < pmf.length; m++) {
          const w = pmf[m]
          if (w === 0) continue
          next.push({
            hits: { ...cur.hits, [source]: keptHits + m },
            factor: cur.factor * split.weight * w,
            consumed: cur.consumed + spent.length,
          })
        }
      }
    }
    outcomes = next
  }
  return outcomes
}

/** Apply REROLL `target` semantics to a `PerSourceHits` map, returning
 *  every post-reroll outcome with its multiplicative probability factor.
 *  Per-source rerolls are independent, so the outcomes form the cross
 *  product of per-source rerolled PMFs. Sources outside the spec's
 *  `units` filter pass through untouched.
 *
 *  - `'ALL'`   — every die rerolled with a fresh face; keptHits = 0.
 *  - `'MISSES'`— only miss dice (`N - k`) are rerolled; the original `k`
 *                hits stay.
 *  - `'HITS'`  — only hit dice (`k`) are rerolled; the original misses
 *                (`N - k`) stay as misses (so keptHits = 0). */
function rerollHits(
  hits: PerSourceHits,
  sourceMap: Record<Source, FlatSource>,
  target: 'MISSES' | 'HITS' | 'ALL',
  units?: UnitType[],
): { hits: PerSourceHits; factor: number }[] {
  let perm: { hits: PerSourceHits; factor: number }[] = [
    { hits: {}, factor: 1 },
  ]
  for (const source of Object.keys(hits)) {
    const k = hits[source]
    if (units && !sourceMatches(source, sourceMap, units)) {
      for (const cur of perm) cur.hits[source] = k
      continue
    }
    const info = sourceMap[source]
    const totalDice = info.unitCount * info.dicePerUnit
    const p = hitProb(info.hitValue)
    const rerolledCount =
      target === 'ALL' ? totalDice : target === 'MISSES' ? totalDice - k : k
    const keptHits = target === 'MISSES' ? k : 0
    const pmf = binomial(rerolledCount, p)
    const next: { hits: PerSourceHits; factor: number }[] = []
    for (const cur of perm) {
      for (let m = 0; m < pmf.length; m++) {
        const w = pmf[m]
        if (w === 0) continue
        next.push({
          hits: { ...cur.hits, [source]: keptHits + m },
          factor: cur.factor * w,
        })
      }
    }
    perm = next
  }
  return perm
}

/** When a firing side's dice are routed to itself (e.g. Proxima's
 *  self-bombardment), what the player wants from the roll inverts —
 *  hits-on-self are bad, misses-on-self are good. Engine-level swap keeps
 *  reroll-authoring abilities (Agnlan Oln, Scramble Frequency, …)
 *  opponent-facing:
 *   - `target`: `'MISSES'` ↔ `'HITS'` (reroll bad rolls); `'ALL'` passes
 *     through unchanged.
 *   - `rerollIf`: negated. The author's "fire when the roll is bad
 *     (against the opponent)" reads as "fire when the roll is good
 *     (against the self)" — same intent, opposite branch. */
export function flipRerollSpecsForSelfTarget(
  specs: readonly RerollTargetSpec[],
): RerollTargetSpec[] {
  return specs.map(spec => {
    const target: RerollTargetSpec['target'] =
      spec.target === 'ALL'
        ? 'ALL'
        : spec.target === 'MISSES'
          ? 'HITS'
          : 'MISSES'
    const rerollIf = spec.rerollIf
      ? (side: RerollSide) => !spec.rerollIf!(side)
      : undefined
    return { ...spec, target, rerollIf }
  })
}

/** Apply a sequence of REROLL specs to per-source branches. Each branch
 *  carries arbitrary `Meta` (preserved across rerolls) plus `hits` and
 *  `probability`. The factory recombines a rerolled outcome with the
 *  source branch's metadata, receiving the fired `spec` and the uses
 *  `consumed` so it can bill on the resulting branch (e.g. set
 *  `usesDelta[spec.key] = consumed`; `consumed` is 1 except for per-unit
 *  rerolls, where it is the number of units rerolled — possibly 0 in
 *  outcomes where no unit qualified). Unfired branches are passed through
 *  untouched — their factory is never invoked, so they don't bill. */
export function applyRerollSpecs<
  Meta,
  B extends { hits: PerSourceHits; probability: number } & Meta,
>(
  branches: B[],
  sourceMap: Record<Source, FlatSource>,
  specs: readonly RerollTargetSpec[],
  factory: (
    base: B,
    hits: PerSourceHits,
    probability: number,
    spec: RerollTargetSpec,
    consumed: number,
  ) => B,
): B[] {
  let out = branches
  for (const spec of specs) {
    const distribution = marginalize(out)
    const next: B[] = []
    for (const branch of out) {
      const total = totalHits(branch.hits)
      if (!fires(spec.rerollIf, total, distribution)) {
        next.push(branch)
        continue
      }
      // Per-unit rerolls: expand into per-unit splits with budgeted,
      // per-unit spending and variable billing.
      if (spec.perUnit && spec.units) {
        const outcomes = perUnitRerollOutcomes(branch.hits, sourceMap, spec)
        if (outcomes === null) {
          next.push(branch)
          continue
        }
        for (const o of outcomes) {
          next.push(
            factory(
              branch,
              o.hits,
              branch.probability * o.factor,
              spec,
              o.consumed,
            ),
          )
        }
        continue
      }
      // A scoped reroll with nothing to reroll on its sources is not fired —
      // the branch passes through and keeps its use.
      if (spec.units && rerollableDice(branch.hits, sourceMap, spec) === 0) {
        next.push(branch)
        continue
      }
      for (const r of rerollHits(
        branch.hits,
        sourceMap,
        spec.target,
        spec.units,
      )) {
        next.push(
          factory(branch, r.hits, branch.probability * r.factor, spec, 1),
        )
      }
    }
    out = next
  }
  return out
}
