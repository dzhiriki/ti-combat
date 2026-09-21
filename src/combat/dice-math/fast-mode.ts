import type { CombatSide, UnitType } from '@/types'

import type { MetaPhase } from '../combat-state/types'
import {
  type DiceMathBranch,
  makeEmptyPendingHitPool,
  type PendingHitPool,
} from './branch-accumulator'
import {
  applyRerollSpecs,
  flipRerollSpecsForSelfTarget,
  type PerSourceHits,
} from './phases/apply-rerolls'
import { collapseSideOutcomes } from './phases/collapse-side-outcomes'
import type { Bucket, PreSplit, SideBuckets } from './pre-split'
import type {
  CollectedDice,
  FlatSource,
  Modifier,
  RerollModifier,
  RerollTargetSpec,
  SideDiceCollection,
  Source,
} from './types'
import { buildSourceMap } from './types'
import { binomial, hitProb } from './utils/get-dice-distribution'

interface FastModeInput {
  dice: CollectedDice
  preSplit: PreSplit
  modifiers: Modifier[]
  unitAbilityPriority?: { attacker: UnitType[]; defender: UnitType[] }
  meta: MetaPhase
  /** True for a self-targeting roll (Proxima self-bomb): flip reroll specs
   *  so "reroll misses" becomes "reroll hits" against the firer's own dice. */
  selfTarget?: boolean
  /** When set, collapse extreme tail outcomes per side whose marginal
   *  probability is < threshold before the joint cross-product. */
  collapseThreshold?: number
}

/**
 * Fast mode (docs/dice-math.md §3): a binomial distribution over total
 * hits per bucket, no per-unit-type split. Step 4 has already partitioned
 * each firing side's sources into siphon buckets + one rest bucket.
 *
 * When the side has no REROLL specs, we convolve per-bucket binomials and
 * cross-product the two firing sides — one branch per joint outcome.
 *
 * When REROLL specs are present, we drop down to per-source enumeration,
 * run the reroll pass (`applyRerollSpecs` — shared with per-unit-type-mode),
 * then collapse to bucket totals before the cross product. Branches with
 * identical bucket totals merge so the final cross product stays small.
 *
 * Rest-bucket unit-ability hits use the landing pool's resolved priority for
 * both eligibility and assignment order. Combat hits remain in the primary
 * unrestricted pool. Each siphon bucket's hit count is fed to its spec's
 * `transform(count)` and appended as an additional HitPool.
 */
export function runFastMode(input: FastModeInput): DiceMathBranch[] {
  const sides = (['attacker', 'defender'] as const).map(firingSide => {
    const rawRerolls = pickRerolls(input.modifiers, firingSide)
    const rerolls = input.selfTarget
      ? flipRerollSpecsForSelfTarget(rawRerolls)
      : rawRerolls
    const plan = planSide(
      input.dice[firingSide],
      input.preSplit[firingSide],
      rerolls,
    )
    const outcomes =
      input.collapseThreshold !== undefined
        ? collapseSideOutcomes(
            plan.outcomes,
            o => o.bucketHits.reduce((a, b) => a + b, 0),
            input.collapseThreshold,
          )
        : plan.outcomes
    return { firingSide, plan: { outcomes } }
  })

  const branches: DiceMathBranch[] = []
  for (const aOutcome of sides[0].plan.outcomes) {
    for (const dOutcome of sides[1].plan.outcomes) {
      const prob = aOutcome.probability * dOutcome.probability
      if (prob === 0) continue
      const pools: Record<CombatSide, PendingHitPool> = {
        attacker: makeEmptyPendingHitPool(),
        defender: makeEmptyPendingHitPool(),
      }
      emitPools(
        aOutcome,
        input.preSplit[sides[0].firingSide],
        input.unitAbilityPriority?.[
          input.preSplit[sides[0].firingSide].landingSide
        ],
        input.meta,
        pools,
      )
      emitPools(
        dOutcome,
        input.preSplit[sides[1].firingSide],
        input.unitAbilityPriority?.[
          input.preSplit[sides[1].firingSide].landingSide
        ],
        input.meta,
        pools,
      )
      branches.push({
        probability: prob,
        pendingHitPool: pools,
        usesDelta: new Map(),
        destroyedUnits: new Set(),
        pendingEffects: [],
      })
    }
  }
  return branches
}

interface SideOutcome {
  probability: number
  /** Per-bucket hit counts, aligned with `SideBuckets.buckets`. */
  bucketHits: number[]
}

interface SidePlan {
  outcomes: SideOutcome[]
}

function planSide(
  dice: SideDiceCollection,
  side: SideBuckets,
  rerolls: RerollTargetSpec[],
): SidePlan {
  if (rerolls.length === 0) return planSideFast(dice, side)
  // Reroll specs targeting a side with no rolled dice are no-ops — fall
  // back to the no-reroll path so the spec doesn't fire on an empty pool.
  // See per-unit-type.ts for the matching guard and the Scramble Frequency
  // bug it prevents.
  const hasDice = Object.keys(dice).some(variant => {
    const entries = dice[variant as keyof SideDiceCollection]
    return entries && entries.length > 0
  })
  if (!hasDice) return planSideFast(dice, side)
  return planSideWithRerolls(dice, side, rerolls)
}

/** Fast path: no REROLL — convolve per-source binomials within each bucket,
 *  cross-product per-bucket PMFs into side outcomes. */
function planSideFast(dice: SideDiceCollection, side: SideBuckets): SidePlan {
  const sourceMap = buildSourceMap(dice)
  const pmfs = side.buckets.map(b => bucketPmf(sourceMap, b.sources))
  let outcomes: SideOutcome[] = [{ probability: 1, bucketHits: [] }]
  for (const pmf of pmfs) {
    const next: SideOutcome[] = []
    for (const o of outcomes) {
      for (let k = 0; k < pmf.length; k++) {
        const p = pmf[k]
        if (p === 0) continue
        next.push({
          probability: o.probability * p,
          bucketHits: [...o.bucketHits, k],
        })
      }
    }
    outcomes = next
  }
  return { outcomes }
}

/** Reroll path: enumerate per-source hits, run reroll pass, then collapse
 *  branches to per-bucket totals. */
function planSideWithRerolls(
  dice: SideDiceCollection,
  side: SideBuckets,
  rerolls: RerollTargetSpec[],
): SidePlan {
  const sourceMap = buildSourceMap(dice)
  const sources = side.buckets.flatMap(b =>
    b.sources.map(src => sourceMap[src]).filter((s): s is FlatSource => !!s),
  )
  let branches = initialPerSourceBranches(sources)
  branches = applyRerollSpecs(
    branches,
    sourceMap,
    rerolls,
    // Fast mode only runs when there's no `rerollIf` predicate (every
    // branch fires unconditionally), so per-branch use billing isn't
    // needed here — `markOneShotUses` handles the (unconditional)
    // accounting for these specs.
    (_base, hits, probability) => ({ hits, probability }),
  )

  const outcomes = new Map<string, SideOutcome>()
  for (const branch of branches) {
    const bucketHits = side.buckets.map(b =>
      b.sources.reduce((sum, src) => sum + (branch.hits[src] ?? 0), 0),
    )
    const key = bucketHits.join(',')
    const existing = outcomes.get(key)
    if (existing) existing.probability += branch.probability
    else outcomes.set(key, { probability: branch.probability, bucketHits })
  }
  return { outcomes: Array.from(outcomes.values()) }
}

interface PerSourceBranch {
  probability: number
  hits: PerSourceHits
}

function initialPerSourceBranches(sources: FlatSource[]): PerSourceBranch[] {
  let branches: PerSourceBranch[] = [{ probability: 1, hits: {} }]
  for (const s of sources) {
    const totalDice = s.unitCount * s.dicePerUnit
    if (totalDice <= 0) continue
    const pmf = binomial(totalDice, hitProb(s.hitValue))
    const next: PerSourceBranch[] = []
    for (const b of branches) {
      for (let k = 0; k < pmf.length; k++) {
        const p = pmf[k]
        if (p === 0) continue
        next.push({
          probability: b.probability * p,
          hits: { ...b.hits, [s.source]: k },
        })
      }
    }
    branches = next
  }
  return branches
}

function pickRerolls(
  modifiers: Modifier[],
  side: CombatSide,
): RerollTargetSpec[] {
  const idx: 0 | 1 = side === 'attacker' ? 0 : 1
  const out: RerollTargetSpec[] = []
  for (const m of modifiers) {
    if (m.type !== 'REROLL') continue
    const spec = (m as RerollModifier).target[idx]
    if (spec) out.push(spec)
  }
  return out
}

function bucketPmf(
  sourceMap: Record<Source, FlatSource>,
  sources: Source[],
): number[] {
  const pmfs: number[][] = []
  for (const source of sources) {
    const info = sourceMap[source]
    if (!info) continue
    const totalDice = info.unitCount * info.dicePerUnit
    if (totalDice <= 0) continue
    pmfs.push(binomial(totalDice, hitProb(info.hitValue)))
  }
  return convolve(pmfs)
}

function emitPools(
  outcome: SideOutcome,
  side: SideBuckets,
  unitAbilityPriority: UnitType[] | undefined,
  meta: MetaPhase,
  pools: Record<CombatSide, PendingHitPool>,
): void {
  const landingSide = side.landingSide
  const pool = pools[landingSide]
  for (let i = 0; i < side.buckets.length; i++) {
    const bucket: Bucket = side.buckets[i]
    const hits = outcome.bucketHits[i]
    if (hits <= 0) continue
    if (bucket.spec) {
      const entry = bucket.spec.transform(hits)
      pool.custom.push({
        key: bucket.spec.key,
        base: entry.base,
        unitPriority: entry.unitPriority,
      })
    } else if (unitAbilityPriority !== undefined) {
      pool.custom.push({
        key: meta,
        base: hits,
        unitPriority: [...unitAbilityPriority],
      })
    } else {
      pool.base += hits
    }
  }
}

function convolve(pmfs: number[][]): number[] {
  if (pmfs.length === 0) return [1]
  let state = pmfs[0].slice()
  for (let i = 1; i < pmfs.length; i++) {
    const a = state
    const b = pmfs[i]
    const next = new Array<number>(a.length + b.length - 1).fill(0)
    for (let x = 0; x < a.length; x++) {
      const ax = a[x]
      if (ax === 0) continue
      for (let y = 0; y < b.length; y++) {
        const by = b[y]
        if (by === 0) continue
        next[x + y] += ax * by
      }
    }
    state = next
  }
  return state
}
