import type { CombatSide } from '@/types'

import type {
  AdditionalHitPoolTargetSpec,
  ConditionalModifierTargetSpec,
  CustomRollTargetSpec,
  Modifier,
  ModifierDecl,
  RerollTargetSpec,
  RollTriggerTargetSpec,
  SidedTarget,
} from './types'

interface CollectModifiersInput {
  /** Raw declarations queued on the dice-roll group by ability APIs. The
   *  list is consumed by-type — entries that aren't kernel modifiers
   *  (HIT_VALUE / SET_DICE_COUNT / ADD_DICE_COUNT / ADD_DICE_GROUP) are
   *  applied to the dice collection elsewhere in the kernel pipeline. */
  modifiers: readonly ModifierDecl[]
  /** AbilityKey → uses available, used to seed `limit` on conditional
   *  modifiers. Missing entries fall back to 1. */
  abilityUses?: Map<string, number>
}

/**
 * Step 2 (docs/dice-math.md): collect engine-declared modifiers into the
 * dice-math `Modifier[]` shape.
 *
 * Each declaration is grouped by `abilityKey` (and decl-kind) so that an
 * ability registering both OWN and OPPONENT halves emerges as a single
 * `Modifier` entry with both tuple slots filled. The tuple is indexed
 * `[attacker, defender]`; downstream consumers (`per-unit-type`,
 * `fast-mode`) follow the same convention.
 */
export function collectModifiers(input: CollectModifiersInput): Modifier[] {
  const out: Modifier[] = []
  const firing: CombatSide = 'attacker'

  // REROLL. Two decls may share an `abilityKey` when both sides own the
  // same ability (e.g. attacker AND defender both running SCRAMBLE_FREQUENCY).
  // We group by `(ownerSide, abilityKey)` rather than `abilityKey` alone so
  // per-fire billing attributes uses to the correct side — `RerollTargetSpec`
  // carries `ownerSide` for the same reason.
  const rerollByKey = new Map<string, SidedTarget<RerollTargetSpec>>()
  for (const d of input.modifiers) {
    if (d.type !== 'REROLL') continue
    const usesKey = `${d.ownerSide}|${d.abilityKey}`
    const declaredUses = input.abilityUses?.get(usesKey)
    const slot: RerollTargetSpec = {
      key: d.abilityKey,
      ownerSide: d.ownerSide,
      target: d.target ?? 'ALL',
      units: d.unitType && d.unitType.length > 0 ? [...d.unitType] : undefined,
      perUnit: d.perUnit,
      // Budget for per-unit rerolls (1 use per rerolled unit).
      limit: Number.isFinite(declaredUses)
        ? (declaredUses as number)
        : Infinity,
      rerollIf: d.rerollIf,
    }
    const idx: 0 | 1 = d.side === firing ? 0 : 1
    const groupKey = `${d.ownerSide}|${d.abilityKey}`
    upsertSlot(rerollByKey, groupKey, idx, slot)
  }
  for (const target of rerollByKey.values()) {
    out.push({ type: 'REROLL', target })
  }

  // CONDITIONAL_MODIFIER. The decl's `side` is the affected side (the SideApi
  // the ability called); `ownerSide` is the ability owner. The target slot is
  // indexed by the affected side relative to `firing`. We group by
  // `(ownerSide, abilityKey)` — like REROLL — so the same key owned by both
  // sides bills independently, and `uses` resolve against the owner.
  const condByKey = new Map<
    string,
    SidedTarget<ConditionalModifierTargetSpec>
  >()
  for (const d of input.modifiers) {
    if (d.type !== 'CONDITIONAL_MODIFIER') continue
    const usesKey = `${d.ownerSide}|${d.abilityKey}`
    const declaredUses = input.abilityUses?.get(usesKey)
    const limit = Number.isFinite(declaredUses) ? (declaredUses as number) : 1
    const slot: ConditionalModifierTargetSpec = {
      key: d.abilityKey,
      ownerSide: d.ownerSide,
      bonus: d.amount,
      limit,
      preferred: d.preferred,
    }
    const idx: 0 | 1 = d.side === firing ? 0 : 1
    upsertSlot(condByKey, usesKey, idx, slot)
  }
  for (const target of condByKey.values()) {
    out.push({ type: 'CONDITIONAL_MODIFIER', target })
  }

  // ADDITIONAL_HIT_POOL
  const ahpByKey = new Map<string, SidedTarget<AdditionalHitPoolTargetSpec>>()
  for (const d of input.modifiers) {
    if (d.type !== 'ADDITIONAL_HIT_POOL') continue
    const slot: AdditionalHitPoolTargetSpec = {
      key: d.abilityKey,
      units: d.units,
      transform: d.transform,
    }
    const idx: 0 | 1 = d.side === firing ? 0 : 1
    upsertSlot(ahpByKey, d.abilityKey, idx, slot)
  }
  for (const target of ahpByKey.values()) {
    out.push({ type: 'ADDITIONAL_HIT_POOL', target })
  }

  // ROLL_TRIGGER. Multiple decls for the same ability (e.g. one per
  // firing destroyer carrying STRIKE_WING_ALPHA_II) collapse to a single
  // modifier — they share `faces` / `extraHits` / `effect` callback.
  // Source filters merge across decls; an empty `unitType` array means
  // "every source on the affected side", and unions stay empty.
  const ntByKey = new Map<string, SidedTarget<RollTriggerTargetSpec>>()
  for (const d of input.modifiers) {
    if (d.type !== 'ROLL_TRIGGER') continue
    const idx: 0 | 1 = d.side === firing ? 0 : 1
    let entry = ntByKey.get(d.abilityKey)
    if (!entry) {
      entry = [undefined, undefined]
      ntByKey.set(d.abilityKey, entry)
    }
    const existing = entry[idx]
    if (existing) {
      // Union variant filters; any unfiltered decl keeps the spec open.
      if (existing.units && d.unitType.length > 0) {
        for (const u of d.unitType) {
          if (!existing.units.includes(u)) existing.units.push(u)
        }
      } else if (d.unitType.length === 0) {
        existing.units = undefined
      }
    } else {
      entry[idx] = {
        key: d.abilityKey,
        slotId: d.slotId,
        faces: d.faces,
        units: d.unitType.length > 0 ? [...d.unitType] : undefined,
      }
    }
  }
  for (const target of ntByKey.values()) {
    out.push({ type: 'ROLL_TRIGGER', target })
  }

  // CUSTOM_ROLL
  const crByKey = new Map<string, SidedTarget<CustomRollTargetSpec>>()
  for (const d of input.modifiers) {
    if (d.type !== 'CUSTOM_ROLL') continue
    const slot: CustomRollTargetSpec = {
      key: d.abilityKey,
      shouldTransform: d.shouldTransform,
      createGenerator: d.createGenerator,
    }
    const idx: 0 | 1 = d.side === firing ? 0 : 1
    upsertSlot(crByKey, d.abilityKey, idx, slot)
  }
  for (const target of crByKey.values()) {
    out.push({ type: 'CUSTOM_ROLL', target })
  }

  return out
}

function upsertSlot<T>(
  map: Map<string, SidedTarget<T>>,
  key: string,
  idx: 0 | 1,
  slot: T,
): void {
  let entry = map.get(key)
  if (!entry) {
    entry = [undefined, undefined]
    map.set(key, entry)
  }
  entry[idx] = slot
}
