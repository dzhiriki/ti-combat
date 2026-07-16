import type { CombatSide, UnitType } from '@/types'

import type { HitSource, MetaPhase, SideStateData } from '../combat-state/types'
import { type DiceMathBranch, type PendingHitPool } from './branch-accumulator'
import { collectModifiers } from './collect-modifiers'
import { runFastMode } from './fast-mode'
import { runPerUnitTypeMode } from './per-unit-type'
import { applyDiceShapeModifiers } from './phases/apply-dice-shape-modifiers'
import { applyStoredHitValueModifiers } from './phases/apply-stored-hit-value-modifiers'
import { collapseBranches } from './phases/collapse-branches'
import { preSplit } from './pre-split'
import type { HitsDist, RerollSide } from './reroll-strategy'
import type {
  CollectedDice,
  HitValueModifierDecl,
  Modifier,
  ModifierDecl,
  RerollDecl,
  SideDiceCollection,
} from './types'
import { marginalizeBaseHits } from './utils/marginalize-base-hits'

interface DiceMathInput {
  /** Mutated in place by stored hit-value modifiers, dice-shape mutators,
   *  and non-firing-side trim. Callers that need the post-modifier shape
   *  (e.g. for DICE_POOL logging) re-read the same reference after
   *  `runDiceMath` returns. */
  diceCollection: CollectedDice
  /** All declarations queued by ability APIs on the dice-roll group, in
   *  push order. The kernel partitions by type internally. */
  modifiers: readonly ModifierDecl[]
  hitSource: HitSource
  firing: readonly CombatSide[]
  isUnitAbility: boolean
  /** True for a Proxima-style self-targeting roll: hits are still produced
   *  against the natural opponent (then swapped to the firer post-roll by a
   *  script method), but the dice-shape `ADD_DICE_COUNT` suppression and the
   *  reroll-spec flip apply as if the firer is shooting itself. */
  selfTarget?: boolean
  /** Per-landing-side meta-level target restriction (only set for
   *  unit-ability rolls). Becomes the `unitPriority` of a custom entry
   *  attached to the landing side's hit pool, ordered by `priorityList`. */
  validTargets: { attacker: UnitType[]; defender: UnitType[] }
  /** Per-landing-side phase-sacrifice priority — variant keys in
   *  cheapest-first order. Used to sort `validTargets` into the custom
   *  entry's `unitPriority`. */
  priorityList: {
    attacker: UnitType[] | undefined
    defender: UnitType[] | undefined
  }
  sideData: { attacker: SideStateData; defender: SideStateData }
  /** abilityKey → uses available for conditional modifiers / one-shot decls. */
  abilityUses: Map<string, number>
  /** Current meta — used for the AFB fighter-pool clamp and as the
   *  `key` on unit-ability custom entries. */
  meta: MetaPhase
  /** AFB-context AFTER_UNIT_ABILITY_ROLL abilities on the firing side
   *  read excess-hit counts; clamping would hide them. Engine sets these
   *  flags after inspecting its invoke registry. */
  skipAfbClampForTarget?: { attacker: boolean; defender: boolean }
  /** When set, the math kernel collapses extreme tail outcomes per side
   *  whose marginal probability (grouped by total hits) is < threshold
   *  before the joint cross-product. Undefined = full precision. */
  collapseThreshold?: number
}

interface DiceMathResult {
  /** Empty when `isEmpty`. */
  branches: DiceMathBranch[]
  /** True when the collection is empty after dice-shape / stored-modifier
   *  application and non-firing trim. Only set under `isUnitAbility`.
   *  Engine cancels the meta script (no DICE_POOL log, no further phases). */
  isEmpty: boolean
}

/**
 * Math kernel entry. Implements docs/dice-math.md:
 *   Step 1  — collect dice with bonuses applied. Receive the per-side
 *             `SideDiceCollection` (built upstream) and mutate in place via
 *             two BEFORE-timing sub-steps from `phases/`:
 *               1) `applyDiceShapeModifiers` — SET_DICE_COUNT /
 *                  ADD_DICE_COUNT / ADD_DICE_GROUP in push order so later
 *                  mods see earlier collection state;
 *               2) `applyStoredHitValueModifiers` — HIT_VALUE per side.
 *             Drop dice for non-firing sides; bail when the collection has
 *             nothing left to roll.
 *   Step 2  — collect modifiers (REROLL / CONDITIONAL_MODIFIER /
 *             ADDITIONAL_HIT_POOL / ROLL_TRIGGER / CUSTOM_ROLL).
 *   Step 3  — decide mode.
 *   Step 4  — split each side's source map by ADDITIONAL_HIT_POOL units.
 *   Fast mode — binomial total-hits distribution per bucket; REROLL specs
 *               (when present) run per-source via `applyRerollSpecs` and
 *               the resulting branches collapse to bucket totals.
 *   Per-unit-type mode — joint per-source binomial, then REROLL,
 *                         ROLL_TRIGGER, and CONDITIONAL_MODIFIER passes.
 *   Step 8  — for non-modifier decls with a finite `uses` count, mark a
 *             single use consumed on every branch (one-shot accounting).
 *   Step 9  — AFB fighter-pool clamp.
 */
export function runDiceMath(input: DiceMathInput): DiceMathResult {
  const dice = input.diceCollection

  const selfTarget = input.selfTarget ?? false

  // Step 1.1: dice-shape mutators in push order. Each side reads its own
  // entries; cross-side decls (rare) are filtered by `side === d.side`.
  // `isSelfTarget` is true when the firing side is shooting itself (Proxima
  // self-bomb). ADD_DICE_COUNT is suppressed in that case — the bonus is
  // opponent-facing intent, so granting it on a self-targeted roll would
  // self-inflict. Mirrors the reroll spec flip in apply-rerolls.
  applyDiceShapeModifiers(
    dice.attacker,
    input.modifiers,
    'attacker',
    input.sideData.attacker.unitStats,
    input.hitSource,
    selfTarget && input.firing.includes('attacker'),
  )
  applyDiceShapeModifiers(
    dice.defender,
    input.modifiers,
    'defender',
    input.sideData.defender.unitStats,
    input.hitSource,
    selfTarget && input.firing.includes('defender'),
  )

  // Step 1.2: stored hit-value modifiers per side.
  const hvAttacker: HitValueModifierDecl[] = []
  const hvDefender: HitValueModifierDecl[] = []
  for (const m of input.modifiers) {
    if (m.type !== 'HIT_VALUE') continue
    if (m.side === 'attacker') hvAttacker.push(m)
    else hvDefender.push(m)
  }
  if (hvAttacker.length > 0) {
    applyStoredHitValueModifiers(
      dice.attacker,
      hvAttacker,
      input.sideData.attacker.unitStats,
      input.hitSource,
    )
  }
  if (hvDefender.length > 0) {
    applyStoredHitValueModifiers(
      dice.defender,
      hvDefender,
      input.sideData.defender.unitStats,
      input.hitSource,
    )
  }

  if (input.isUnitAbility) {
    if (!input.firing.includes('attacker')) dice.attacker = {}
    if (!input.firing.includes('defender')) dice.defender = {}
    if (isCollectionEmpty(dice)) return { branches: [], isEmpty: true }
  }

  const modifiers = collectModifiers({
    modifiers: input.modifiers,
    abilityUses: input.abilityUses,
  })
  const split = preSplit(dice, modifiers)

  let branches: DiceMathBranch[] = canRunFast(modifiers)
    ? runFastMode({
        dice,
        preSplit: split,
        modifiers,
        validTargets: input.validTargets,
        priorityList: input.priorityList,
        meta: input.meta,
        selfTarget,
        collapseThreshold: input.collapseThreshold,
      })
    : runPerUnitTypeMode({
        dice,
        preSplit: split,
        modifiers,
        validTargets: input.validTargets,
        priorityList: input.priorityList,
        meta: input.meta,
        selfTarget,
        collapseThreshold: input.collapseThreshold,
      })

  // One-shot use accounting for REROLL decls. REROLL decls are queued from
  // REROLL_DICE_ROLL / REROLL_UNIT_ABILITY_ROLL invokes, which skip the
  // dispatch-time decrement, so they need this path. `consumeUseIf` opts a
  // decl out (e.g. Munitions Reserves pays for the round via
  // START_OF_COMBAT_ROUND, not the reroll itself).
  markOneShotUses(input.modifiers, input.abilityUses, branches)

  // Declaration accounting for every other modifier kind. Invokes flagged
  // `declaration: true` (`wasDeclaration` on the decl) defer their `uses`
  // decrement; bill one use here if the modifier survived the firing-side
  // filter. Non-declaration modifiers keep their dispatch-time decrement and
  // are skipped here to avoid double-billing.
  markDeclarationUses(
    input.modifiers,
    input.abilityUses,
    branches,
    input.firing,
    selfTarget,
  )

  if (input.meta === 'AFB') {
    branches = applyAfbClamp(
      branches,
      input.validTargets,
      input.sideData,
      input.skipAfbClampForTarget,
    )
  }

  return { branches, isEmpty: false }
}

/** Fast mode works when only ADDITIONAL_HIT_POOL / REROLL modifiers (or none)
 *  are present — Step 4 handles the siphon split, and `runFastMode` applies
 *  any rerolls per source before collapsing to bucket totals. */
function canRunFast(modifiers: Modifier[]): boolean {
  for (const m of modifiers) {
    if (m.type === 'REROLL') {
      // Conditional rerolls (with `rerollIf`) and unit-scoped rerolls (with
      // `units`) need per-branch fire-tracking to bill `uses` only on
      // actually-fired branches. That tracking only lives in per-unit-type
      // mode (its `SideBranch` carries `usesDelta`); fast-mode's
      // `PerSourceBranch` collapses outcomes by bucket totals and would lose
      // the per-branch billing distinction.
      if (m.target[0]?.rerollIf || m.target[1]?.rerollIf) return false
      if (m.target[0]?.units || m.target[1]?.units) return false
      continue
    }
    if (m.type !== 'ADDITIONAL_HIT_POOL') return false
  }
  return true
}

function isCollectionEmpty(dice: CollectedDice): boolean {
  return (
    isSideCollectionEmpty(dice.attacker) && isSideCollectionEmpty(dice.defender)
  )
}

function isSideCollectionEmpty(collection: SideDiceCollection): boolean {
  for (const entries of Object.values(collection)) {
    if (entries && entries.length > 0) return false
  }
  return true
}

function markOneShotUses(
  decls: readonly ModifierDecl[],
  abilityUses: Map<string, number>,
  branches: DiceMathBranch[],
): void {
  const rerollDecls: RerollDecl[] = []
  for (const d of decls) {
    if (d.type === 'REROLL') rerollDecls.push(d)
  }
  if (rerollDecls.length === 0) return

  // Marginalize the firing-side hit distribution across branches once per
  // side. Built lazily — only paid for if any REROLL decl has a
  // `consumeUseIf` predicate that needs the side context.
  const marginalCache = new Map<CombatSide, HitsDist>()
  const getMarginal = (firingSide: CombatSide): HitsDist => {
    const cached = marginalCache.get(firingSide)
    if (cached) return cached
    const landing: CombatSide =
      firingSide === 'attacker' ? 'defender' : 'attacker'
    const dist = marginalizeBaseHits(branches, landing)
    marginalCache.set(firingSide, dist)
    return dist
  }

  for (const branch of branches) {
    for (const d of rerollDecls) {
      // Key by `(ownerSide, abilityKey)` so two sides owning the same
      // ability bill independently. See per-unit-type factory for the
      // matching convention.
      const key = `${d.ownerSide}|${d.abilityKey}`
      if (branch.usesDelta.has(key)) continue
      const baseUses = abilityUses.get(key)
      if (baseUses === undefined || !Number.isFinite(baseUses)) continue
      if (d.consumeUseIf !== undefined) {
        const landing: CombatSide =
          d.side === 'attacker' ? 'defender' : 'attacker'
        const rerollSide: RerollSide = {
          total: branch.pendingHitPool[landing].base,
          distribution: getMarginal(d.side),
        }
        if (!d.consumeUseIf(rerollSide)) continue
        branch.usesDelta.set(key, 1)
        continue
      }
      // No `consumeUseIf` override: per-branch billing for conditional
      // (`rerollIf`) and unit-scoped (`unitType`) rerolls is handled inside
      // `applyRerollSpecs` (the factory marks `usesDelta[spec.key]` on the
      // rerolled output, leaving unfired branches' use intact).
      // Unconditional rerolls in fast-mode lack that per-branch tracking,
      // so bill them here.
      if (d.rerollIf === undefined && !d.unitType?.length) {
        branch.usesDelta.set(key, 1)
      }
    }
  }
}

/** Bill `uses` for non-REROLL declarations (invokes flagged
 *  `declaration: true`) whose dispatch-time decrement was deferred. A
 *  declaration survives — and is billed once on every branch — when its side
 *  is firing. ADD_DICE_COUNT is additionally suppressed on a self-targeted
 *  roll (see `applyDiceShapeModifiers`), so it isn't billed there. Decls with
 *  non-finite (`Infinity`) uses are skipped; their delta is a no-op. */
function markDeclarationUses(
  decls: readonly ModifierDecl[],
  abilityUses: Map<string, number>,
  branches: DiceMathBranch[],
  firing: readonly CombatSide[],
  selfTarget: boolean,
): void {
  const billedKeys = new Set<string>()
  for (const d of decls) {
    if (d.type === 'REROLL') continue
    if (d.wasDeclaration !== true) continue
    if (!firing.includes(d.side)) continue
    if (d.type === 'ADD_DICE_COUNT' && selfTarget) continue
    const baseUses = abilityUses.get(d.abilityKey)
    if (baseUses === undefined || !Number.isFinite(baseUses)) continue
    billedKeys.add(d.abilityKey)
  }
  if (billedKeys.size === 0) return

  for (const branch of branches) {
    for (const key of billedKeys) {
      if (!branch.usesDelta.has(key)) branch.usesDelta.set(key, 1)
    }
  }
}

function applyAfbClamp(
  branches: DiceMathBranch[],
  validTargets: { attacker: UnitType[]; defender: UnitType[] },
  sideData: { attacker: SideStateData; defender: SideStateData },
  skipForTarget: { attacker: boolean; defender: boolean } | undefined,
): DiceMathBranch[] {
  let out = branches
  out = clampForFiringSide(
    out,
    'attacker',
    'defender',
    validTargets,
    sideData,
    skipForTarget,
  )
  out = clampForFiringSide(
    out,
    'defender',
    'attacker',
    validTargets,
    sideData,
    skipForTarget,
  )
  return out
}

function clampForFiringSide(
  branches: DiceMathBranch[],
  firingSide: CombatSide,
  targetSide: CombatSide,
  validTargets: { attacker: UnitType[]; defender: UnitType[] },
  sideData: { attacker: SideStateData; defender: SideStateData },
  skipForTarget: { attacker: boolean; defender: boolean } | undefined,
): DiceMathBranch[] {
  if (!isFighterOnlyTargets(validTargets[targetSide])) return branches
  if (skipForTarget?.[firingSide]) return branches
  const maxFighters = countParticipatingFighters(sideData[targetSide])
  let any = false
  for (const b of branches) {
    const clamped = clampFighterHitPool(
      b.pendingHitPool[targetSide],
      maxFighters,
    )
    if (clamped !== b.pendingHitPool[targetSide]) {
      b.pendingHitPool[targetSide] = clamped
      any = true
    }
  }
  return any ? collapseBranches(branches) : branches
}

function isFighterOnlyTargets(targets: UnitType[]): boolean {
  return targets.length === 1 && targets[0] === 'FIGHTER'
}

function countParticipatingFighters(side: SideStateData): number {
  let n = 0
  for (const id of side.participatingUnits) {
    const t = side.unitType[id]
    if (!t) continue
    if (t === 'FIGHTER' || t.startsWith('FIGHTER:')) n++
  }
  return n
}

/** Cap a side's FIGHTER-only AFB custom entry so its `base` doesn't
 *  exceed the available fighter targets. AFB rolls produce a single
 *  custom entry per side (keyed by the meta) with `unitPriority` =
 *  ['FIGHTER']. When `maxFighters` is zero the entry is removed
 *  entirely so the branch collapses with already-0-hit siblings. */
function clampFighterHitPool(
  pool: PendingHitPool,
  maxFighters: number,
): PendingHitPool {
  let mutated = false
  const out: PendingHitPool['custom'] = []
  for (const c of pool.custom) {
    const isFighterOnly =
      c.unitPriority.length === 1 && c.unitPriority[0] === 'FIGHTER'
    if (!isFighterOnly) {
      out.push(c)
      continue
    }
    if (c.base <= maxFighters) {
      out.push(c)
      continue
    }
    mutated = true
    if (maxFighters === 0) continue
    out.push({ key: c.key, base: maxFighters, unitPriority: c.unitPriority })
  }
  if (!mutated) return pool
  return { base: pool.base, custom: out }
}
