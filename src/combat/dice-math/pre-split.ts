import type { CombatSide, UnitType } from '@/types'

import { parseUnitLocator } from '../utils/parse-unit-locator'
import type {
  AdditionalHitPoolModifier,
  AdditionalHitPoolTargetSpec,
  CollectedDice,
  Modifier,
  Source,
} from './types'
import { flattenSources } from './types'

export interface Bucket {
  /** Source keys (from `CollectedDice`) that belong to this bucket. */
  sources: Source[]
  /** When set, this bucket's hits feed `spec.transform(count)` and land
   *  as a dedicated HitPool on the landing side. Undefined = "rest" bucket
   *  whose hits go to the side's primary unrestricted pool. */
  spec?: AdditionalHitPoolTargetSpec
}

export interface SideBuckets {
  /** Where this firing side's hits land. */
  landingSide: CombatSide
  /** N spec buckets followed by one trailing "rest" bucket. */
  buckets: Bucket[]
}

export interface PreSplit {
  attacker: SideBuckets
  defender: SideBuckets
}

/**
 * PRE step (docs/dice-math.md §3): when ADDITIONAL_HIT_POOL modifiers are present,
 * split each side's source map into N siphon buckets + one "rest" bucket
 * BEFORE handing off to the mode-specific logic (global / per-unit-type).
 *
 * Each downstream mode operates on each bucket independently; results are
 * recombined into branches by the caller, with siphoned-bucket hit counts
 * fed through the spec's `transform` to produce additional HitPools.
 *
 * The slot index lookup is: `target[0]` siphons attacker's dice,
 * `target[1]` siphons defender's dice. This matches `collect-modifiers`'
 * default `firingSide='attacker'` convention where decls whose `side`
 * equals the firing side land in slot 0 and the opposite in slot 1.
 */
export function preSplit(dice: CollectedDice, modifiers: Modifier[]): PreSplit {
  const additional = modifiers.filter(
    (m): m is AdditionalHitPoolModifier => m.type === 'ADDITIONAL_HIT_POOL',
  )
  return {
    attacker: splitForFiringSide('attacker', dice, additional),
    defender: splitForFiringSide('defender', dice, additional),
  }
}

function splitForFiringSide(
  firingSide: CombatSide,
  dice: CollectedDice,
  additional: AdditionalHitPoolModifier[],
): SideBuckets {
  const firingIdx: 0 | 1 = firingSide === 'attacker' ? 0 : 1
  const specs = additional
    .map(m => m.target[firingIdx])
    .filter((s): s is AdditionalHitPoolTargetSpec => s !== undefined)

  const sideDice = dice[firingSide]
  const buckets: Bucket[] = specs.map(spec => ({ sources: [], spec }))
  const rest: Bucket = { sources: [] }

  for (const flat of flattenSources(sideDice)) {
    let placed = false
    for (let i = 0; i < specs.length; i++) {
      if (matchUnit(flat.variant, specs[i].units)) {
        buckets[i].sources.push(flat.source)
        placed = true
        break
      }
    }
    if (!placed) rest.sources.push(flat.source)
  }
  buckets.push(rest)

  const landingSide: CombatSide =
    firingSide === 'attacker' ? 'defender' : 'attacker'
  return { landingSide, buckets }
}

function matchUnit(variantKey: UnitType, units: UnitType[]): boolean {
  if (units.length === 0) return false
  if (units.includes(variantKey)) return true
  const baseType = parseUnitLocator(variantKey).baseType as UnitType
  return units.includes(baseType)
}
