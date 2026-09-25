import { UNIT_TYPES, UNIT_WORTH } from '@/constants/units'
import type { UnitBaseType, UnitVariantId } from '@/types'

import type { DeclaredSubtype, SyncSortSpec } from '../abilities-engine/types'
import { parseUnitLocator } from './parse-unit-locator'
import { makeVariantId } from './unit-variant'

export function sortBaseTypes(
  types: UnitBaseType[],
  sort: SyncSortSpec,
): UnitBaseType[] {
  if (typeof sort === 'function') return [...types].sort(sort)
  const compare =
    sort === 'worth-asc' || sort === 'worth-desc'
      ? (a: UnitBaseType, b: UnitBaseType) => UNIT_WORTH[a] - UNIT_WORTH[b]
      : (a: UnitBaseType, b: UnitBaseType) =>
          UNIT_TYPES.indexOf(a) - UNIT_TYPES.indexOf(b)
  const sorted = [...types].sort(compare)
  return sort === 'worth-desc' || sort === 'normal-desc'
    ? sorted.reverse()
    : sorted
}

export function expandWithSubtypes(
  sortedTypes: UnitBaseType[],
  subtypes: DeclaredSubtype[],
  sort: SyncSortSpec = 'worth-asc',
): string[] {
  // Custom comparators don't carry direction info — treat as ascending so
  // subtype variants follow their parent.
  const direction =
    typeof sort === 'function'
      ? 'asc'
      : sort === 'worth-desc' || sort === 'normal-desc'
        ? 'desc'
        : 'asc'
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
