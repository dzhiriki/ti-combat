import type { CombatSide, UnitType } from '@/types'

import type { MetaPhase } from '../combat-state/types'
import { parseVariantId } from '../utils/unit-variant'
import type { DiceMathBranch, PendingEffect } from './branch-accumulator'
import {
  makeEmptyPendingHitPool,
  type PendingHitPool,
} from './branch-accumulator'
import {
  applyRerollSpecs,
  flipRerollSpecsForSelfTarget,
} from './phases/apply-rerolls'
import { collapseBranches } from './phases/collapse-branches'
import { collapseSideOutcomes } from './phases/collapse-side-outcomes'
import type { PreSplit, SideBuckets } from './pre-split'
import { sortValidTargetsByPriority } from './sort-valid-targets'
import type {
  CollectedDice,
  ConditionalModifier,
  ConditionalModifierTargetSpec,
  CustomRollModifier,
  CustomRollTargetSpec,
  FlatSource,
  Modifier,
  RerollModifier,
  RerollTargetSpec,
  RollTriggerModifier,
  RollTriggerTargetSpec,
  Source,
} from './types'
import { buildSourceMap, flattenSources } from './types'
import { binomial, hitProb } from './utils/get-dice-distribution'

interface PerUnitTypeInput {
  dice: CollectedDice
  preSplit: PreSplit
  modifiers: Modifier[]
  validTargets: { attacker: UnitType[]; defender: UnitType[] }
  priorityList: {
    attacker: UnitType[] | undefined
    defender: UnitType[] | undefined
  }
  meta: MetaPhase
  /** True for a self-targeting roll (Proxima self-bomb): flip reroll specs
   *  so "reroll misses" becomes "reroll hits" against the firer's own dice. */
  selfTarget?: boolean
  /** When set, collapse extreme tail outcomes per side whose marginal
   *  probability (sum of all per-source hits) is < threshold before the
   *  joint cross-product. */
  collapseThreshold?: number
}

/**
 * Per-unit-type mode (dice-math spec §5): per-side, build the joint
 * binomial distribution over `hits: Record<Source, number>` (Source =
 * `${variant}#${entryIdx}`), traverse REROLL modifiers (step 5a),
 * ROLL_TRIGGER (step 5b — runs before CONDITIONAL_MODIFIER per the
 * in-function comment), then CONDITIONAL_MODIFIER (step 5c). Branches
 * with identical (hits, usesDelta, pendingEffects) collapse between
 * modifiers.
 *
 * Final assembly (step 7): for each combined attacker×defender side
 * outcome, sum per-source hits within each Step-4 bucket. Rest buckets
 * feed the primary HitPool with the side's default validTargets; siphon
 * buckets feed their spec's `transform(count)` and the result is
 * appended to the landing side's pools.
 */
export function runPerUnitTypeMode(input: PerUnitTypeInput): DiceMathBranch[] {
  const sourceMaps: Record<CombatSide, Record<Source, FlatSource>> = {
    attacker: buildSourceMap(input.dice.attacker),
    defender: buildSourceMap(input.dice.defender),
  }
  const sides = (['attacker', 'defender'] as const).map(side => {
    const sources = flattenSources(input.dice[side])
    const sourceMap = sourceMaps[side]
    const sideCustomRolls = pickCustomRolls(input.modifiers, side)
    let branches = initialBranches(sources, sideCustomRolls)
    const rawSideRerolls = pickRerolls(input.modifiers, side)
    const sideRerolls = input.selfTarget
      ? flipRerollSpecsForSelfTarget(rawSideRerolls)
      : rawSideRerolls
    // A reroll spec targeting a side with no rolled dice is a no-op: no
    // probability change and no use billed. Catches abilities like
    // Scramble Frequency declaring on the non-firing side during a
    // single-sided unit-ability roll — without this guard the empty-pool
    // branch still passes `rerollIf` for several strategies and bills a
    // phantom use, divergent state hashes inflate the cache, and odds
    // shift even though nothing was actually rerolled.
    if (sideRerolls.length > 0 && sources.length > 0) {
      branches = applyRerollSpecs(
        branches,
        sourceMap,
        sideRerolls,
        (base, hits, probability, spec, consumed) => {
          // Bill the uses on the rerolled output. Branches whose `rerollIf`
          // didn't fire skip this factory entirely and keep their use.
          // Key by `(ownerSide, abilityKey)` so when both sides own the
          // same ability (e.g. attacker + defender both running
          // SCRAMBLE_FREQUENCY) each side's fire bills its own owner.
          // `consumed` is 1 except for per-unit rerolls (units rerolled;
          // 0 in outcomes where no unit qualified — nothing billed).
          if (consumed === 0) {
            return {
              probability,
              hits,
              usesDelta: base.usesDelta,
              pendingEffects: base.pendingEffects,
            }
          }
          const usesDelta = new Map(base.usesDelta)
          usesDelta.set(`${spec.ownerSide}|${spec.key}`, consumed)
          return {
            probability,
            hits,
            usesDelta,
            pendingEffects: base.pendingEffects,
          }
        },
      )
      branches = collapseSideBranches(branches)
    }
    // ROLL_TRIGGER runs BEFORE CONDITIONAL_MODIFIER even though the spec
    // lists the conditional pass as step 4 and the trigger pass as step 5.
    // The trigger fires on the natural face (the die's roll, not its post-
    // flip identity). Once CONDITIONAL_MODIFIER has converted a face-6 miss
    // into a hit, that die joins the hit bucket and the trigger pass — which
    // assumes uniform face distribution within hits — would spuriously
    // promote it into the natural-9/10 pool. Running the trigger first uses
    // the post-reroll, pre-flip face distribution, which IS face-uniform
    // within each bucket, so trigger enumeration is exact and Heart-flipped
    // dice can never become naturals.
    const sideNaturals = pickRollTriggers(input.modifiers, side)
    for (const spec of sideNaturals) {
      branches = applyRollTrigger(branches, sourceMap, spec, side)
      branches = collapseSideBranches(branches)
    }
    if (input.collapseThreshold !== undefined) {
      branches = collapseSideOutcomes(
        branches,
        b => {
          let sum = 0
          for (const v of Object.values(b.hits)) sum += v
          return sum
        },
        input.collapseThreshold,
      )
    }
    return { side, branches }
  })

  // ALL conditional ±1 flips — one-sided (`own` / `opponent`) and two-sided
  // shared-budget "Any" cards (Heart of Ixth, Meddle) alike — resolve in ONE
  // joint pass here, once the cross-product exposes both sides' per-source
  // hits. A single pass is what keeps the math exact: same-sign cards stack on
  // a die (Heart + Meddle reach a deficit-2 miss) and opposite-sign cards act
  // on disjoint natural face pools (misses vs hits), while applying cards in
  // separate passes would blindly re-enumerate faces an earlier pass already
  // resolved (a boosted natural 5 is not a cancellable natural 6).
  const conditionals = input.modifiers.filter(
    (m): m is ConditionalModifier => m.type === 'CONDITIONAL_MODIFIER',
  )
  const selfTarget = input.selfTarget ?? false

  const out: DiceMathBranch[] = []
  for (const a of sides[0].branches) {
    for (const d of sides[1].branches) {
      const prob = a.probability * d.probability
      if (prob === 0) continue
      let joints: JointConditionalOutcome[] = [
        {
          attackerHits: a.hits,
          defenderHits: d.hits,
          usesDelta: mergeUses(a.usesDelta, d.usesDelta),
          probability: 1,
        },
      ]
      if (conditionals.length > 0) {
        const next: JointConditionalOutcome[] = []
        for (const j of joints) {
          next.push(
            ...applyConditionalModifiers(
              j,
              conditionals,
              sourceMaps,
              selfTarget,
            ),
          )
        }
        joints = next
      }
      for (const j of joints) {
        const jointProb = prob * j.probability
        if (jointProb === 0) continue
        const pools: Record<CombatSide, PendingHitPool> = {
          attacker: makeEmptyPendingHitPool(),
          defender: makeEmptyPendingHitPool(),
        }
        emitPools(
          j.attackerHits,
          input.preSplit.attacker,
          input.validTargets[input.preSplit.attacker.landingSide],
          input.priorityList[input.preSplit.attacker.landingSide],
          input.meta,
          pools,
        )
        emitPools(
          j.defenderHits,
          input.preSplit.defender,
          input.validTargets[input.preSplit.defender.landingSide],
          input.priorityList[input.preSplit.defender.landingSide],
          input.meta,
          pools,
        )
        out.push({
          probability: jointProb,
          pendingHitPool: pools,
          usesDelta: j.usesDelta,
          destroyedUnits: new Set(),
          pendingEffects: [...a.pendingEffects, ...d.pendingEffects],
        })
      }
    }
  }
  return collapseBranches(out)
}

function mergeUses(
  a: Map<string, number>,
  b: Map<string, number>,
): Map<string, number> {
  if (a.size === 0 && b.size === 0) return new Map()
  const out = new Map(a)
  for (const [k, v] of b) out.set(k, (out.get(k) ?? 0) + v)
  return out
}

// ============================================================================
// Side-level branch state
// ============================================================================

interface SideBranch {
  probability: number
  /** Per-source hit count. Sources missing from the record produced no dice. */
  hits: Record<Source, number>
  /** AbilityKey → use count consumed in this branch (for this side). */
  usesDelta: Map<string, number>
  /** Side-effect entries forwarded to the engine's branch dispatcher.
   *  Populated by ROLL_TRIGGER specs that carry an `effect` callback. */
  pendingEffects: PendingEffect[]
}

function initialBranches(
  sources: FlatSource[],
  customRolls: CustomRollTargetSpec[],
): SideBranch[] {
  let branches: SideBranch[] = [
    { probability: 1, hits: {}, usesDelta: new Map(), pendingEffects: [] },
  ]
  for (const s of sources) {
    const totalDice = s.unitCount * s.dicePerUnit
    if (totalDice <= 0) continue
    const pmf = entryPmf(s, customRolls)
    const next: SideBranch[] = []
    for (const b of branches) {
      for (let k = 0; k < pmf.length; k++) {
        const p = pmf[k]
        if (p === 0) continue
        next.push({
          probability: b.probability * p,
          hits: { ...b.hits, [s.source]: k },
          usesDelta: b.usesDelta,
          pendingEffects: b.pendingEffects,
        })
      }
    }
    branches = next
  }
  return branches
}

/** Resolve the entry's hit PMF. If a CUSTOM_ROLL spec matches (deterministic
 *  scan in declaration order — first match wins), produce the per-unit PMF
 *  via its generator and convolve `unitCount` copies. Otherwise fall back to
 *  the natural binomial over the entry's total dice. */
function entryPmf(
  s: FlatSource,
  customRolls: CustomRollTargetSpec[],
): number[] {
  const totalDice = s.unitCount * s.dicePerUnit
  for (const spec of customRolls) {
    if (!spec.shouldTransform(s.hitValue, s.dicePerUnit)) continue
    const perUnit = spec.createGenerator(s.hitValue, s.dicePerUnit)
    return convolveN(perUnit, s.unitCount)
  }
  return binomial(totalDice, hitProb(s.hitValue))
}

function pickCustomRolls(
  modifiers: Modifier[],
  side: CombatSide,
): CustomRollTargetSpec[] {
  const idx: 0 | 1 = side === 'attacker' ? 0 : 1
  const out: CustomRollTargetSpec[] = []
  for (const m of modifiers) {
    if (m.type !== 'CUSTOM_ROLL') continue
    const spec = (m as CustomRollModifier).target[idx]
    if (spec) out.push(spec)
  }
  return out
}

/** Convolve `pmf` with itself `n` times (polynomial multiplication over PMFs).
 *  `n === 0` collapses to the unit mass at 0; `n === 1` returns `pmf`. */
function convolveN(pmf: number[], n: number): number[] {
  if (n <= 0) return [1]
  if (n === 1) return [...pmf]
  let result = pmf
  for (let i = 1; i < n; i++) result = convolvePmf(result, pmf)
  return result
}

function convolvePmf(a: number[], b: number[]): number[] {
  const out = new Array<number>(a.length + b.length - 1).fill(0)
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]
    if (ai === 0) continue
    for (let j = 0; j < b.length; j++) {
      const bj = b[j]
      if (bj === 0) continue
      out[i + j] += ai * bj
    }
  }
  return out
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

interface JointConditionalOutcome {
  attackerHits: Record<Source, number>
  defenderHits: Record<Source, number>
  usesDelta: Map<string, number>
  probability: number
}

interface CondSlot {
  sign: 1 | -1
  magnitude: number
  preferred: boolean
}

/** One conditional card, normalized: `limit` (= the owner's `uses`) is shared
 *  across however many slots the card declared — one for `own`/`opponent`
 *  targets, two for "Any". */
interface CondCard {
  key: string
  ownerSide: CombatSide
  limit: number
  slots: Record<CombatSide, CondSlot | undefined>
}

/** Apply ALL conditional modifiers — one-sided and two-sided "Any" cards
 *  alike — to a joint cross-product branch in one exact pass. On a
 *  self-targeting roll (Proxima self-bomb) the firer shoots itself, so the
 *  tuple-slot→side mapping swaps, mirroring the post-roll `_swapHitPools`:
 *  a conditional declared against the firer's opponent lands on the firer's
 *  self-routed dice, while one declared against the firer routes to the
 *  (empty) opposite side and drops out.
 *
 *  Per side there are two flip pools: positive tiers live inside the natural
 *  misses and negative tiers inside the natural hits — disjoint face sets, so
 *  one two-sign enumeration per side is exact, a die flipped by one card is
 *  never re-targeted by an opposing one (the 5c convention), and same-sign
 *  cards stack (tier-T dice flip by combining T distinct cards, so Heart of
 *  Ixth + Meddle rescue a deficit-2 miss).
 *
 *  Allocation is greedy: pools that some card marks preferred go first (an
 *  "Any" card prefers its own-boost pool by default), then the rest in a
 *  fixed order; within a pool, cheapest tier first (a tier-T flip costs T
 *  uses), capped by the pool's contributing cards' remaining budgets, which
 *  are fungible (a 2-use card may spend both uses on one die). Consumed uses
 *  debit contributing cards in sorted-key order up to each one's remaining
 *  budget — deterministic regardless of PREPARE shuffle order, mirroring the
 *  historical batch pass. */
function applyConditionalModifiers(
  branch: JointConditionalOutcome,
  modifiers: ConditionalModifier[],
  sourceMaps: Record<CombatSide, Record<Source, FlatSource>>,
  selfTarget: boolean,
): JointConditionalOutcome[] {
  const cards: CondCard[] = []
  let sourceFilter: ConditionalModifierTargetSpec['source']
  for (const m of modifiers) {
    const attackerSpec = selfTarget ? m.target[1] : m.target[0]
    const defenderSpec = selfTarget ? m.target[0] : m.target[1]
    const ref = (attackerSpec ?? defenderSpec)!
    if (ref.limit <= 0) continue
    // Same source filter assumed across the batch — pick from first.
    sourceFilter ??= attackerSpec?.source ?? defenderSpec?.source
    const toSlot = (
      spec: ConditionalModifierTargetSpec | undefined,
    ): CondSlot | undefined =>
      spec && {
        sign: spec.bonus > 0 ? 1 : -1,
        magnitude: Math.abs(spec.bonus),
        preferred: spec.preferred === true,
      }
    cards.push({
      key: ref.key,
      ownerSide: ref.ownerSide,
      limit: ref.limit,
      slots: { attacker: toSlot(attackerSpec), defender: toSlot(defenderSpec) },
    })
  }
  if (cards.length === 0) return [branch]
  cards.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))

  // Per-side tier depth for each sign — the max combined shift one die can
  // receive from the cards feeding that pool.
  const depth = (side: CombatSide, sign: 1 | -1): number =>
    cards.reduce((s, c) => {
      const slot = c.slots[side]
      return slot && slot.sign === sign ? s + slot.magnitude : s
    }, 0)
  const dPosA = depth('attacker', 1)
  const dNegA = depth('attacker', -1)
  const dPosD = depth('defender', 1)
  const dNegD = depth('defender', -1)

  const attackerFlips = enumerateFlippableTiersTwoSign(
    branch.attackerHits,
    sourceMaps.attacker,
    sourceFilter,
    dPosA,
    dNegA,
  )
  const defenderFlips = enumerateFlippableTiersTwoSign(
    branch.defenderHits,
    sourceMaps.defender,
    sourceFilter,
    dPosD,
    dNegD,
  )

  const out: JointConditionalOutcome[] = []
  for (const af of attackerFlips) {
    for (const df of defenderFlips) {
      const probability = branch.probability * af.probability * df.probability
      if (probability === 0) continue

      const pools = [
        {
          side: 'attacker' as const,
          sign: 1 as const,
          tiers: af.posTierTotals,
          flips: new Array<number>(dPosA + 1).fill(0),
        },
        {
          side: 'defender' as const,
          sign: 1 as const,
          tiers: df.posTierTotals,
          flips: new Array<number>(dPosD + 1).fill(0),
        },
        {
          side: 'attacker' as const,
          sign: -1 as const,
          tiers: af.negTierTotals,
          flips: new Array<number>(dNegA + 1).fill(0),
        },
        {
          side: 'defender' as const,
          sign: -1 as const,
          tiers: df.negTierTotals,
          flips: new Array<number>(dNegD + 1).fill(0),
        },
      ]
      const isPreferred = (p: (typeof pools)[number]) =>
        cards.some(c => {
          const slot = c.slots[p.side]
          return slot !== undefined && slot.sign === p.sign && slot.preferred
        })
      const ordered = [
        ...pools.filter(p => isPreferred(p)),
        ...pools.filter(p => !isPreferred(p)),
      ]

      // Greedy: preferred pools first, cheapest tier first, capped by the
      // pool's fungible budget; debits hit contributors in sorted-key order.
      const budgets = cards.map(c => c.limit)
      const spent = new Array<number>(cards.length).fill(0)
      for (const pool of ordered) {
        const contributors: number[] = []
        for (let i = 0; i < cards.length; i++) {
          const slot = cards[i].slots[pool.side]
          if (slot && slot.sign === pool.sign) contributors.push(i)
        }
        if (contributors.length === 0) continue
        let budget = contributors.reduce((s, i) => s + budgets[i], 0)
        let consumed = 0
        for (let T = 1; T < pool.tiers.length; T++) {
          if (budget < T) break
          const canFlip = Math.min(pool.tiers[T], Math.floor(budget / T))
          pool.flips[T] = canFlip
          budget -= T * canFlip
          consumed += T * canFlip
        }
        let remaining = consumed
        for (const i of contributors) {
          if (remaining <= 0) break
          const take = Math.min(budgets[i], remaining)
          if (take === 0) continue
          budgets[i] -= take
          spent[i] += take
          remaining -= take
        }
      }

      let usesDelta = branch.usesDelta
      if (spent.some(s => s > 0)) {
        usesDelta = new Map(branch.usesDelta)
        for (let i = 0; i < cards.length; i++) {
          if (spent[i] === 0) continue
          const usesKey = `${cards[i].ownerSide}|${cards[i].key}`
          usesDelta.set(usesKey, (usesDelta.get(usesKey) ?? 0) + spent[i])
        }
      }

      let attackerHits = branch.attackerHits
      attackerHits = distributeTierFlips(
        attackerHits,
        af.perSource.map(ps => ({ source: ps.source, counts: ps.pos })),
        pools[0].flips,
        1,
      )
      attackerHits = distributeTierFlips(
        attackerHits,
        af.perSource.map(ps => ({ source: ps.source, counts: ps.neg })),
        pools[2].flips,
        -1,
      )
      let defenderHits = branch.defenderHits
      defenderHits = distributeTierFlips(
        defenderHits,
        df.perSource.map(ps => ({ source: ps.source, counts: ps.pos })),
        pools[1].flips,
        1,
      )
      defenderHits = distributeTierFlips(
        defenderHits,
        df.perSource.map(ps => ({ source: ps.source, counts: ps.neg })),
        pools[3].flips,
        -1,
      )

      out.push({ attackerHits, defenderHits, usesDelta, probability })
    }
  }
  return out
}

interface TwoSignFlippableOutcome {
  /** Per matched source, dice sitting on each flippable tier for each sign
   *  (`pos[T]` = misses exactly T below the hit value, `neg[T]` = hits
   *  exactly T-1 above-or-at it; index 0 unused). */
  perSource: { source: Source; pos: number[]; neg: number[] }[]
  /** Tier totals across all matched sources (index 0 unused). */
  posTierTotals: number[]
  negTierTotals: number[]
  probability: number
}

/** Enumerate, per source on a side, the joint distribution of dice sitting on
 *  each flippable tier for BOTH signs at once: positive tiers live inside the
 *  source's misses and negative tiers inside its hits, so the two multinomials
 *  are independent given the branch's hit count and one pass is exact. */
function enumerateFlippableTiersTwoSign(
  hits: Record<Source, number>,
  sourceMap: Record<Source, FlatSource>,
  sourceFilter: ConditionalModifierTargetSpec['source'],
  dPos: number,
  dNeg: number,
): TwoSignFlippableOutcome[] {
  let outcomes: TwoSignFlippableOutcome[] = [
    {
      perSource: [],
      posTierTotals: new Array<number>(dPos + 1).fill(0),
      negTierTotals: new Array<number>(dNeg + 1).fill(0),
      probability: 1,
    },
  ]
  if (dPos <= 0 && dNeg <= 0) return outcomes
  const matched = matchedSources(hits, sourceMap, sourceFilter)
  for (const source of matched) {
    const info = sourceMap[source]
    if (!info) continue
    const k = hits[source] ?? 0
    const totalDice = info.unitCount * info.dicePerUnit
    const missFaces = info.hitValue - 1
    const hitFaces = 11 - info.hitValue
    // Tiers past the face range don't exist (e.g. hit-on-2 has one miss
    // face); enumerate only the reachable ones and leave the rest at zero.
    const effPos = Math.min(dPos, missFaces)
    const effNeg = Math.min(dNeg, hitFaces)
    const posDist = enumerateTierMultinomial(totalDice - k, effPos, missFaces)
    const negDist = enumerateTierMultinomial(k, effNeg, hitFaces)
    const next: TwoSignFlippableOutcome[] = []
    for (const o of outcomes) {
      for (const p of posDist) {
        for (const n of negDist) {
          const pos = new Array<number>(dPos + 1).fill(0)
          const neg = new Array<number>(dNeg + 1).fill(0)
          const posTierTotals = o.posTierTotals.slice()
          const negTierTotals = o.negTierTotals.slice()
          for (let t = 0; t < effPos; t++) {
            pos[t + 1] = p.counts[t]
            posTierTotals[t + 1] += p.counts[t]
          }
          for (let t = 0; t < effNeg; t++) {
            neg[t + 1] = n.counts[t]
            negTierTotals[t + 1] += n.counts[t]
          }
          next.push({
            perSource: [...o.perSource, { source, pos, neg }],
            posTierTotals,
            negTierTotals,
            probability: o.probability * p.probability * n.probability,
          })
        }
      }
    }
    outcomes = next
  }
  return outcomes
}

/** Apply the allocated tier flips across a side's sources in declaration
 *  order (each source capped by its per-tier flippable count). A flipped die
 *  changes the hit count by ±1 regardless of tier; tier only affects cost. */
function distributeTierFlips(
  hits: Record<Source, number>,
  perSource: { source: Source; counts: number[] }[],
  flipsByTier: number[],
  sign: 1 | -1,
): Record<Source, number> {
  let total = 0
  for (let T = 1; T < flipsByTier.length; T++) total += flipsByTier[T]
  if (total <= 0) return hits
  const out = { ...hits }
  const remaining = flipsByTier.slice()
  for (const ps of perSource) {
    let sourceFlips = 0
    for (let T = 1; T < remaining.length; T++) {
      const take = Math.min(ps.counts[T], remaining[T])
      sourceFlips += take
      remaining[T] -= take
    }
    if (sourceFlips > 0) {
      out[ps.source] = (out[ps.source] ?? 0) + sign * sourceFlips
    }
  }
  return out
}

/** Enumerate the multinomial joint (m_1, m_2, ..., m_D, m_high) with
 *  Σ = N, where each tier 1..D corresponds to one specific face value
 *  (probability `1/tierFaces` per die) and m_high collects all faces
 *  with deficit/margin > D. Returns 0 outcomes for empty pools. */
function enumerateTierMultinomial(
  N: number,
  D: number,
  tierFaces: number,
): { counts: number[]; probability: number }[] {
  if (N <= 0 || tierFaces <= 0) {
    return [{ counts: new Array<number>(D + 1).fill(0), probability: 1 }]
  }
  const pT = 1 / tierFaces
  const pHigh = Math.max(0, (tierFaces - D) / tierFaces)
  const out: { counts: number[]; probability: number }[] = []

  const recurse = (level: number, remaining: number, counts: number[]) => {
    if (level === D) {
      const mHigh = remaining
      const full = [...counts, mHigh]
      out.push({
        counts: full,
        probability: multinomialPmf(N, full, pT, pHigh),
      })
      return
    }
    for (let m = 0; m <= remaining; m++) {
      counts.push(m)
      recurse(level + 1, remaining - m, counts)
      counts.pop()
    }
  }
  recurse(0, N, [])
  return out
}

function multinomialPmf(
  N: number,
  counts: number[],
  pT: number,
  pHigh: number,
): number {
  // counts has D+1 entries; first D share pT, last is m_high with pHigh.
  let coeff = factorial(N)
  for (const c of counts) coeff /= factorial(c)
  const D = counts.length - 1
  let p = 1
  for (let i = 0; i < D; i++) {
    if (counts[i] === 0) continue
    if (pT === 0) return 0
    p *= Math.pow(pT, counts[i])
  }
  const mHigh = counts[D]
  if (mHigh > 0) {
    if (pHigh === 0) return 0
    p *= Math.pow(pHigh, mHigh)
  }
  return coeff * p
}

function factorial(n: number): number {
  let r = 1
  for (let i = 2; i <= n; i++) r *= i
  return r
}

function matchedSources(
  hits: Record<Source, number>,
  sourceMap: Record<Source, FlatSource>,
  variantFilter: UnitType | undefined,
): Source[] {
  const sources = Object.keys(hits)
  if (variantFilter === undefined) return sources
  return sources.filter(s => sourceMap[s]?.variant === variantFilter)
}

function matchedSourcesByUnits(
  hits: Record<Source, number>,
  sourceMap: Record<Source, FlatSource>,
  units: UnitType[] | undefined,
): Source[] {
  const sources = Object.keys(hits)
  if (!units || units.length === 0) return sources
  // `sourceMap[s].variant` is the dice-pool outer key (currently base type
  // — see `CombatSideState.collectDice`). A ROLL_TRIGGER filter may be
  // stated as a variant key (e.g. 'FLAGSHIP:Galvanized') or a base type
  // ('FLAGSHIP'); expand each entry to its base type so both forms match.
  const allowedBaseTypes = new Set<UnitType>(
    units.map(u => parseVariantId(u).type as UnitType),
  )
  return sources.filter(s => {
    const key = sourceMap[s]?.variant
    if (key === undefined) return false
    if (units.includes(key)) return true
    if (allowedBaseTypes.has(key)) return true
    const baseType = parseVariantId(key).type as UnitType
    return units.includes(baseType) || allowedBaseTypes.has(baseType)
  })
}

function pickRollTriggers(
  modifiers: Modifier[],
  side: CombatSide,
): RollTriggerTargetSpec[] {
  const idx: 0 | 1 = side === 'attacker' ? 0 : 1
  const out: RollTriggerTargetSpec[] = []
  for (const m of modifiers) {
    if (m.type !== 'ROLL_TRIGGER') continue
    const spec = (m as RollTriggerModifier).target[idx]
    if (spec) out.push(spec)
  }
  return out
}

/**
 * ROLL_TRIGGER (dice-math spec §5). For each source matched by the
 * spec's `units` filter (or every source when undefined), enumerate the
 * joint distribution of trigger counts conditioned on the branch's
 * current (hits, misses) split. The total trigger count rides on a
 * per-branch pending effect; the engine's branch-construction step
 * (see `_branchesFromMathKernel`) dispatches each effect against the
 * freshly-forked branch state so anything the effect does (extra hits,
 * destroyed units, etc.) is already reflected when `advance()` returns.
 *
 * Conditional-face probabilities:
 *   p(trigger | hit)  = | faces ∩ {h..10}  | / (11 - h)
 *   p(trigger | miss) = | faces ∩ {1..h-1} | /  (h - 1)
 *
 * Relies on uniform face distribution within each die's hit / miss
 * bucket — true after step 3 (REROLL) because both `target='ALL'` and
 * `target='MISSES'` leave the surviving hit/miss faces uniform. Running
 * BEFORE step 4 keeps that invariant; once CONDITIONAL_MODIFIER mixes a
 * face-6 flip into the hit bucket the assumption would break.
 */
function applyRollTrigger(
  branches: SideBranch[],
  sourceMap: Record<Source, FlatSource>,
  spec: RollTriggerTargetSpec,
  side: CombatSide,
): SideBranch[] {
  const next: SideBranch[] = []
  for (const branch of branches) {
    const matched = matchedSourcesByUnits(branch.hits, sourceMap, spec.units)
    if (matched.length === 0) {
      next.push(branch)
      continue
    }

    // Per-source joint distribution of trigger counts.
    const perSource = matched.map(source => {
      const info = sourceMap[source]
      const k = branch.hits[source] ?? 0
      const n = info.unitCount * info.dicePerUnit
      const h = info.hitValue
      const hitTrigFaces = spec.faces.filter(f => f >= h && f <= 10).length
      const missTrigFaces = spec.faces.filter(f => f >= 1 && f < h).length
      const pHit = 11 - h > 0 ? hitTrigFaces / (11 - h) : 0
      const pMiss = h - 1 > 0 ? missTrigFaces / (h - 1) : 0
      const pmfHit = binomial(k, pHit)
      const pmfMiss = binomial(n - k, pMiss)
      const dist: { count: number; probability: number }[] = []
      for (let th = 0; th < pmfHit.length; th++) {
        for (let tm = 0; tm < pmfMiss.length; tm++) {
          const p = pmfHit[th] * pmfMiss[tm]
          if (p === 0) continue
          dist.push({ count: th + tm, probability: p })
        }
      }
      return { source, dist }
    })

    // Cross-product across matched sources.
    let combos: { perSource: number[]; probability: number }[] = [
      { perSource: [], probability: 1 },
    ]
    for (const ps of perSource) {
      const nextCombos: typeof combos = []
      for (const c of combos) {
        for (const item of ps.dist) {
          nextCombos.push({
            perSource: [...c.perSource, item.count],
            probability: c.probability * item.probability,
          })
        }
      }
      combos = nextCombos
    }

    for (const combo of combos) {
      let totalT = 0
      for (const t of combo.perSource) totalT += t
      const newEffects =
        totalT > 0
          ? [
              ...branch.pendingEffects,
              {
                kind: 'rollTrigger' as const,
                abilityKey: spec.key,
                slotId: spec.slotId,
                side,
                payload: { count: totalT },
              },
            ]
          : branch.pendingEffects
      next.push({
        probability: branch.probability * combo.probability,
        hits: branch.hits,
        usesDelta: branch.usesDelta,
        pendingEffects: newEffects,
      })
    }
  }
  return next
}

function collapseSideBranches(branches: SideBranch[]): SideBranch[] {
  const map = new Map<string, SideBranch>()
  for (const b of branches) {
    const key = `${serializeHits(b.hits)}|${serializeUses(b.usesDelta)}|${serializeSideEffects(b.pendingEffects)}`
    const existing = map.get(key)
    if (existing) {
      existing.probability += b.probability
    } else {
      map.set(key, {
        probability: b.probability,
        hits: b.hits,
        usesDelta: b.usesDelta,
        pendingEffects: b.pendingEffects,
      })
    }
  }
  return Array.from(map.values())
}

function serializeSideEffects(effects: PendingEffect[]): string {
  if (effects.length === 0) return ''
  return effects
    .map(e => {
      if (e.kind === 'rollTrigger') {
        const payload = e.payload as { count: number }
        return `n:${e.abilityKey}:${e.slotId}:${e.side}:${payload.count}`
      }
      return `${e.kind}:${e.abilityKey}:${e.slotId}:${e.side}`
    })
    .join('@')
}

function serializeHits(hits: Record<Source, number>): string {
  const keys = Object.keys(hits).sort()
  return keys.map(k => `${k}=${hits[k]}`).join(',')
}

function serializeUses(uses: Map<string, number>): string {
  if (uses.size === 0) return ''
  return Array.from(uses.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join(',')
}

// ============================================================================
// Hit-pool assembly (step 6)
// ============================================================================

function emitPools(
  hits: Record<Source, number>,
  side: SideBuckets,
  validTargets: UnitType[],
  priorityList: UnitType[] | undefined,
  meta: MetaPhase,
  pools: Record<CombatSide, PendingHitPool>,
): void {
  const landingSide = side.landingSide
  const pool = pools[landingSide]
  for (const bucket of side.buckets) {
    let count = 0
    for (const source of bucket.sources) {
      count += hits[source] ?? 0
    }
    if (count <= 0) continue
    if (bucket.spec) {
      const entry = bucket.spec.transform(count)
      pool.custom.push({
        key: bucket.spec.key,
        base: entry.base,
        unitPriority: entry.unitPriority,
      })
    } else if (validTargets.length > 0) {
      pool.custom.push({
        key: meta,
        base: count,
        unitPriority: sortValidTargetsByPriority(validTargets, priorityList),
      })
    } else {
      pool.base += count
    }
  }
}
