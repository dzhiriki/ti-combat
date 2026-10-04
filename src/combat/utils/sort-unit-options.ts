import { UNIT_TYPES, UNIT_WORTH } from '@/constants/units'
import type { UnitBaseType, UnitStats, UnitType, UnitVariantId } from '@/types'

import type { DeclaredSubtype, SyncSortSpec } from '../abilities-engine/types'
import type { SideStateData } from '../combat-state/types'
import { parseUnitLocator } from './parse-unit-locator'
import { resolveUnitStats } from './resolve-unit-stats'
import { makeVariantId } from './unit-variant'

function isDescending(sort: SyncSortSpec): boolean {
  return (
    sort === 'worth-desc' || sort === 'normal-desc' || sort === 'combat-desc'
  )
}

/** Combat sorts order base types by worth; `sortVariantsByCombat` then
 *  reorders the expanded variants, keeping worth order for ties. */
export function sortBaseTypes(
  types: UnitBaseType[],
  sort: SyncSortSpec,
): UnitBaseType[] {
  if (typeof sort === 'function') return [...types].sort(sort)
  const compare =
    sort === 'normal-asc' || sort === 'normal-desc'
      ? (a: UnitBaseType, b: UnitBaseType) =>
          UNIT_TYPES.indexOf(a) - UNIT_TYPES.indexOf(b)
      : (a: UnitBaseType, b: UnitBaseType) => UNIT_WORTH[a] - UNIT_WORTH[b]
  const sorted = [...types].sort(compare)
  return isDescending(sort) ? sorted.reverse() : sorted
}

/** Expected hits of one combat roll. */
function combatStrength(stats: UnitStats | undefined): number {
  if (!stats?.COMBAT) return 0
  const [hit, dice, bonus = 0] = stats.COMBAT
  return (dice + bonus) * Math.min(1, Math.max(0, (11 - hit) / 10))
}

/** A variant's stats: from the side's stats, or built from its base stats
 *  through the declared subtypes' factories when setup holds none. */
function variantStats(
  unitStats: SideStateData['unitStats'],
  subtypes: readonly DeclaredSubtype[],
  variant: UnitType,
): UnitStats | undefined {
  const known = resolveUnitStats(unitStats, variant)
  if (known) return known
  const { baseType, subtypes: names } = parseUnitLocator(variant)
  let stats = resolveUnitStats(unitStats, baseType)
  names.forEach((name, index) => {
    const parent = makeVariantId(baseType, names.slice(0, index))
    const declaration = subtypes.find(
      item => item.name === name && item.unitType === parent,
    )
    if (stats && declaration) stats = declaration.statsFactory(stats)
  })
  return stats
}

/** Stable: variants of equal strength keep their order. */
export function sortVariantsByCombat(
  variants: readonly UnitType[],
  sort: 'combat-asc' | 'combat-desc',
  unitStats: SideStateData['unitStats'],
  subtypes: readonly DeclaredSubtype[],
): UnitType[] {
  const direction = sort === 'combat-desc' ? -1 : 1
  const strength = new Map(
    variants.map(variant => [
      variant,
      combatStrength(variantStats(unitStats, subtypes, variant)),
    ]),
  )
  return [...variants].sort(
    (a, b) => direction * (strength.get(a)! - strength.get(b)!),
  )
}

export function expandWithSubtypes(
  sortedTypes: UnitBaseType[],
  subtypes: DeclaredSubtype[],
  sort: SyncSortSpec = 'worth-asc',
): string[] {
  // Custom comparators don't carry direction info — treat as ascending so
  // subtype variants follow their parent.
  const direction =
    typeof sort !== 'function' && isDescending(sort) ? 'desc' : 'asc'
  const simpleByType = new Map<UnitBaseType, DeclaredSubtype[]>()
  const compound: DeclaredSubtype[] = []

  for (const st of subtypes) {
    const { baseType: type, subtypes: parentSubs } = parseUnitLocator(
      st.unitType,
    )
    if (parentSubs.length === 0) {
      const list = simpleByType.get(type)
      if (list) list.push(st)
      else simpleByType.set(type, [st])
    } else {
      compound.push(st)
    }
  }

  // Subtypes are treated as "better" variants: in desc (best-first) ordering
  // they appear before their parent; in asc they appear after.
  const subBeforeParent = direction === 'desc'

  const result: string[] = []
  const seen = new Set<string>()
  for (const unitType of sortedTypes) {
    const subs = simpleByType.get(unitType)
    if (subBeforeParent && subs) {
      for (const sub of subs) {
        const variantId = makeVariantId(sub.unitType, [
          sub.name as UnitVariantId,
        ])
        if (!seen.has(variantId)) {
          result.push(variantId)
          seen.add(variantId)
        }
      }
    }
    if (!seen.has(unitType)) {
      result.push(unitType)
      seen.add(unitType)
    }
    if (!subBeforeParent && subs) {
      for (const sub of subs) {
        const variantId = makeVariantId(sub.unitType, [
          sub.name as UnitVariantId,
        ])
        if (!seen.has(variantId)) {
          result.push(variantId)
          seen.add(variantId)
        }
      }
    }
  }

  for (const sub of compound) {
    if (!seen.has(sub.unitType)) continue
    const { baseType: type, subtypes: parentSubs } = parseUnitLocator(
      sub.unitType,
    )
    const variantId = makeVariantId(type, [
      ...parentSubs,
      sub.name as UnitVariantId,
    ])
    if (!seen.has(variantId)) {
      const parentIndex = result.indexOf(sub.unitType)
      const insertAt = subBeforeParent ? parentIndex : parentIndex + 1
      result.splice(insertAt, 0, variantId)
      seen.add(variantId)
    }
  }

  return result
}
