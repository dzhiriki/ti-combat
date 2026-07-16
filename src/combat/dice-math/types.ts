import type { CombatSide, UnitBaseType, UnitId, UnitType } from '@/types'

import type { AbilityContext } from '../abilities-engine/api/ability-api'
import type { RerollSide } from './reroll-strategy'

export type SlotId = number

// ============================================================================
// Modifier declarations.
//
// Every dice-related ability API (applyBonusToResult, addDiceCount,
// declareReroll, ...) pushes one of these into `DiceRollContext.modifiers`.
// The math kernel reads the list, applies dice-shape mutations
// (HIT_VALUE / SET_DICE_COUNT / ADD_DICE_COUNT / ADD_DICE_GROUP) in push
// order, then runs the existing collected-modifier pipeline on the rest
// (REROLL / CONDITIONAL_MODIFIER / ROLL_TRIGGER / ADDITIONAL_HIT_POOL /
// CUSTOM_ROLL).
// ============================================================================

/** Stored hit-value modifier — queued by `applyBonusToResult`. */
export interface HitValueModifierDecl {
  type: 'HIT_VALUE'
  slotId: SlotId
  side: CombatSide
  abilityKey: string
  amount: number
  unitType?: string
  excludeUnitTypes?: string[]
  /** When set, the modifier applies to exactly one unit of this variant
   *  (split out of the variant's bucket). Used by abilities like
   *  Gravleash Maneuvers that target a single ship. */
  singleUnit?: string
  /** True when the source invoke was flagged `declaration: true` — the
   *  dispatch-time `uses` decrement was deferred; the kernel must bill
   *  one use if this modifier survives the firing-side filter. */
  wasDeclaration?: boolean
}

/** Override the variant's base dice count, preserving any bonus dice
 *  contributed by stats / earlier abilities. */
export interface SetDiceCountDecl {
  type: 'SET_DICE_COUNT'
  slotId: SlotId
  side: CombatSide
  abilityKey: string
  count: number
  unitType: UnitType
  wasDeclaration?: boolean
}

/** Add `count` to one unit's `dicePerUnit` in the variant with the
 *  best (`'BEST'`) or worst (`'WORST'`) hit value. */
export interface AddDiceCountDecl {
  type: 'ADD_DICE_COUNT'
  slotId: SlotId
  side: CombatSide
  abilityKey: string
  count: number
  target: 'BEST' | 'WORST'
  wasDeclaration?: boolean
}

/** Append a new dice group under the ability's key (a synthetic source). */
export interface AddDiceGroupDecl {
  type: 'ADD_DICE_GROUP'
  slotId: SlotId
  side: CombatSide
  abilityKey: string
  hitValue: number
  dpu: number
  wasDeclaration?: boolean
}

export interface RollTriggerDecl {
  type: 'ROLL_TRIGGER'
  slotId: SlotId
  side: CombatSide
  abilityKey: string
  /** Variant keys or base types whose dice can fire the trigger. Empty
   *  array means no source filter (every die on `side` participates).
   *  The math kernel deduplicates decls by `abilityKey`, so multiple
   *  unit-ability invokes for the same key collapse to a single modifier. */
  unitType: UnitType[]
  faces: number[]
  /** Fired per branch with the number of dice that landed on a trigger
   *  face. Resolved inside the math kernel's branch construction so the
   *  branch state returned by `advance()` already reflects the effect. */
  effect: (count: number, ctx: AbilityContext) => void
  wasDeclaration?: boolean
}

export interface ConditionalModifierDecl {
  type: 'CONDITIONAL_MODIFIER'
  slotId: SlotId
  /** The side whose dice receive the bonus — derived from which SideApi
   *  (`own` / `opponent`) the ability called. May differ from `ownerSide`
   *  (e.g. Heart of Ixth, owned by attacker, applying -1 to defender's
   *  dice via `ctx.api.opponent`). */
  side: CombatSide
  /** The side that owns the ability that pushed this decl. Used by the
   *  use-accounting layer so cross-side bonuses bill `uses` on the owner's
   *  `liveAbilities`, not the affected side's. */
  ownerSide: CombatSide
  abilityKey: string
  /** Optional single-unit target. Omitted = every die on `side`. */
  unit?: UnitId
  amount: number
  /** For a two-sided conditional sharing one use budget (Heart of Ixth "Any"),
   *  marks the slot whose flip is allocated first when a single outcome could
   *  take either side's flip. Ignored for one-sided conditionals. */
  preferred?: boolean
  wasDeclaration?: boolean
}

export interface RerollDecl {
  type: 'REROLL'
  slotId: SlotId
  /** The side whose dice get rerolled. Used by the dice-math kernel for
   *  source filtering and landing-side derivation. */
  side: CombatSide
  /** The side that owns the ability that pushed this decl. Used by the
   *  use-accounting layer so cross-side rerolls (e.g. Scramble Frequency
   *  on defender pushing a reroll on attacker's dice) decrement uses on
   *  the ability owner's `liveAbilities`, not the firing side's phantom
   *  entry. */
  ownerSide: CombatSide
  abilityKey: string
  /** Which dice to reroll. `'MISSES'` rerolls misses, `'HITS'` rerolls
   *  hits, `'ALL'` rerolls every die. When the firing side's dice are
   *  routed to itself (Proxima self-bombardment), the engine swaps
   *  `'MISSES'` ↔ `'HITS'` AND negates `rerollIf` — the author writes the
   *  intuitive opponent-facing intent ("reroll bad rolls") and the engine
   *  applies the same intent to the self-routed roll. */
  target?: 'MISSES' | 'HITS' | 'ALL'
  /** Optional source filter (variant keys or base types, matched like
   *  ROLL_TRIGGER units). Omitted = every source on the affected side.
   *  Scoped rerolls bill per-branch: a branch where the scoped sources
   *  have nothing to reroll passes through unfired and keeps its use. */
  unitType?: UnitType[]
  /** Per-UNIT reroll semantics (requires `unitType`): each unit of the
   *  scoped sources whose reroll-eligible dice count is at least
   *  `threshold` spends 1 use to reroll ITS dice, most-eligible-first,
   *  capped by the ability's remaining `uses`. Bills the actual number of
   *  units rerolled per branch (e.g. Bone Picked Clean spending 1 captured
   *  infantry per mech). */
  perUnit?: { threshold: number }
  rerollIf?: (side: RerollSide) => boolean
  consumeUseIf?: (side: RerollSide) => boolean
  wasDeclaration?: boolean
}

/** ADDITIONAL_HIT_POOL decl (docs/dice-math.md §2). Siphons hits sourced from
 *  `units` into a separate count and runs `transform(count)` to produce
 *  a custom sub-pool that's appended to the landing side's hit pool. */
export interface AdditionalHitPoolDecl {
  type: 'ADDITIONAL_HIT_POOL'
  slotId: SlotId
  /** Landing side — the side whose hit pool gets the custom entry appended. */
  side: CombatSide
  abilityKey: string
  /** Source unit types whose hits get siphoned (matched by base type or
   *  variant key against the firing side's sources). */
  units: UnitType[]
  transform: (count: number) => { base: number; unitPriority: UnitType[] }
  wasDeclaration?: boolean
}

/** Per-unit custom-roll declaration (docs/dice-math.md §1.5). Replaces the
 *  natural binomial PMF with a caller-supplied per-unit distribution.
 *  `shouldTransform(hv, dpu)` is checked against each collection entry's
 *  hit value and dice-per-unit; when it returns true, `createGenerator`
 *  produces the per-unit PMF (length `dpu+1`), and the kernel convolves
 *  `unitCount` independent copies to obtain the entry's PMF. */
export interface CustomRollDecl {
  type: 'CUSTOM_ROLL'
  slotId: SlotId
  side: CombatSide
  abilityKey: string
  shouldTransform: (hitValue: number, dicePerUnit: number) => boolean
  createGenerator: (hitValue: number, dicePerUnit: number) => number[]
  wasDeclaration?: boolean
}

/** Tagged union of every declaration that can be pushed into
 *  `DiceRollContext.modifiers`. */
export type ModifierDecl =
  | HitValueModifierDecl
  | SetDiceCountDecl
  | AddDiceCountDecl
  | AddDiceGroupDecl
  | RollTriggerDecl
  | ConditionalModifierDecl
  | RerollDecl
  | AdditionalHitPoolDecl
  | CustomRollDecl

// ============================================================================
// Step 1 — collected dice (dice-math spec).
//
// Per-variant grouping: each unit type / custom source key carries one
// uniform hit value and a list of distinct [unitCount, dicePerUnit] groups.
// Two units with identical dicePerUnit collapse into one entry; per-unit
// modifiers that diverge a unit's dicePerUnit produce a second entry under
// the same variant key. Hit value is assumed uniform across all units of a
// given variant — per-unit hit-value mutations degenerate to variant-wide
// because every caller invokes the API on all units of the variant.
// ============================================================================

/** Per-base-type dice list: each entry is `[unitCount, hitValue, dicePerUnit]`.
 *  Entries collapse on identical `(hitValue, dicePerUnit)`; per-unit
 *  modifiers (Gravleash picking one cruiser, Linkship per-destroyer SC
 *  source, etc.) produce additional entries with their own values.
 *  Custom dice contributed by `addDiceGroup` are stored under the ability
 *  key (cast to `UnitBaseType`) rather than a real base type. */
export type SideDiceCollection = Partial<
  Record<UnitBaseType, [number, number, number][]>
>

export interface CollectedDice {
  attacker: SideDiceCollection
  defender: SideDiceCollection
}

/** Source = `${variant}#${entryIdx}`. The kernel iterates per (variant,
 *  entryIdx) and uses this string as the hits-map key inside a branch. */
export type Source = string

/** Flattened view of one `(variant, entryIdx)` slot — produced by
 *  `flattenSources` and consumed by the kernel passes. */
export interface FlatSource {
  source: Source
  variant: UnitBaseType
  entryIdx: number
  unitCount: number
  dicePerUnit: number
  hitValue: number
}

/** Build a flat list of `(variant, entryIdx)` source records — the form
 *  the kernel actually iterates over. */
export function flattenSources(dice: SideDiceCollection): FlatSource[] {
  const out: FlatSource[] = []
  for (const variant of Object.keys(dice) as UnitBaseType[]) {
    const entries = dice[variant]
    if (!entries) continue
    for (let i = 0; i < entries.length; i++) {
      const [unitCount, hitValue, dicePerUnit] = entries[i]
      out.push({
        source: `${variant}#${i}`,
        variant,
        entryIdx: i,
        unitCount,
        dicePerUnit,
        hitValue,
      })
    }
  }
  return out
}

/** Source-keyed view of a flat list — handy for `O(1)` lookups while
 *  iterating per-branch logic without re-parsing the source key. */
export function buildSourceMap(
  dice: SideDiceCollection,
): Record<Source, FlatSource> {
  const map: Record<Source, FlatSource> = {}
  for (const entry of flattenSources(dice)) {
    map[entry.source] = entry
  }
  return map
}

// ============================================================================
// Step 2 — collected modifiers (dice-math spec).
//
// `target` is a tuple [OWN?, OPPONENT?] where OWN refers to the firing side
// from this modifier's perspective. The math kernel does not assume a fixed
// attacker/defender mapping.
// ============================================================================

export interface RerollTargetSpec {
  key: string
  /** Ability owner — the side whose `uses` are billed when the reroll
   *  fires. Differs from `RerollModifier.target` slot (which is the dice
   *  side affected): e.g. Scramble Frequency on defender declaring a
   *  reroll on attacker's dice has `ownerSide: 'defender'` but lives in
   *  the attacker slot. Required so per-fire billing attributes correctly
   *  when both sides own the same ability key. */
  ownerSide: CombatSide
  /** Which dice to reroll. `'MISSES'` rerolls failures, `'HITS'` rerolls
   *  successes, `'ALL'` rerolls every die. */
  target: 'MISSES' | 'HITS' | 'ALL'
  /** Optional source filter (variant keys or base types). Omitted = every
   *  source on the affected side. See `RerollDecl.unitType`. */
  units?: UnitType[]
  /** Per-UNIT reroll semantics — see `RerollDecl.perUnit`. */
  perUnit?: { threshold: number }
  /** Budget for `perUnit` rerolls — the ability's `uses` snapshot at
   *  collection time. Each rerolled unit spends 1. */
  limit?: number
  /** Optional gate consulted with the side's pre-reroll aggregate. */
  rerollIf?: (side: RerollSide) => boolean
}

export interface ConditionalModifierTargetSpec {
  key: string
  /** The side that owns the ability — `uses` are billed here, which may
   *  differ from the affected side this spec sits in. */
  ownerSide: CombatSide
  bonus: number
  limit: number
  /** Optional source filter (variant key). Omitted = applies to every
   *  source on the affected side. */
  source?: UnitType
  /** Set on the preferred slot of a two-sided shared-budget conditional
   *  (Heart "Any") — its flip is allocated before the other slot's. */
  preferred?: boolean
}

export interface AdditionalHitPoolTargetSpec {
  key: string
  /** Source unit types (base type or variant key) whose hits get siphoned
   *  into the additional pool. */
  units: UnitType[]
  /** Called with the total siphoned hit count; returns the custom
   *  sub-pool entry to append to the landing side's hit pool. */
  transform: (count: number) => { base: number; unitPriority: UnitType[] }
}

export interface RollTriggerTargetSpec {
  key: string
  /** Slot id of the originating decl. Forwarded to pendingEffects so the
   *  effect dispatcher can look up the decl's `effect` callback. */
  slotId: SlotId
  faces: number[]
  /** Optional source filter (variant key or base type, matched like
   *  ADDITIONAL_HIT_POOL units). Omitted = applies to every source on
   *  the affected side. */
  units?: UnitType[]
}

export interface CustomRollTargetSpec {
  key: string
  shouldTransform: (hitValue: number, dicePerUnit: number) => boolean
  createGenerator: (hitValue: number, dicePerUnit: number) => number[]
}

/** Two-sided target tuple. Index 0 = OWN, index 1 = OPPONENT.
 *  Either slot may be omitted (modifier only applies to one side). */
export type SidedTarget<T> = [T?, T?]

export type RerollModifier = {
  type: 'REROLL'
  target: SidedTarget<RerollTargetSpec>
}

export type ConditionalModifier = {
  type: 'CONDITIONAL_MODIFIER'
  target: SidedTarget<ConditionalModifierTargetSpec>
}

export type AdditionalHitPoolModifier = {
  type: 'ADDITIONAL_HIT_POOL'
  target: SidedTarget<AdditionalHitPoolTargetSpec>
}

export type RollTriggerModifier = {
  type: 'ROLL_TRIGGER'
  target: SidedTarget<RollTriggerTargetSpec>
}

export type CustomRollModifier = {
  type: 'CUSTOM_ROLL'
  target: SidedTarget<CustomRollTargetSpec>
}

export type Modifier =
  | RerollModifier
  | ConditionalModifier
  | AdditionalHitPoolModifier
  | RollTriggerModifier
  | CustomRollModifier
