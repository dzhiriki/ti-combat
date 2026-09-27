import type { SurfaceOptionMeta } from '@/combat/abilities-engine/types'
import { parseUnitLocator } from '@/combat/utils/parse-unit-locator'

export interface SurfaceOption extends SurfaceOptionMeta {
  label: string
  value: string
}

/** The surfaces each `keyOf` value appears on. */
function surfacesBy<T extends SurfaceOption>(
  items: readonly T[],
  keyOf: (item: T) => string,
): Map<string, Set<string>> {
  const locations = new Map<string, Set<string>>()
  for (const item of items) {
    if (!item.surfaceId) continue
    const key = keyOf(item)
    const surfaces = locations.get(key) ?? new Set<string>()
    surfaces.add(item.surfaceId)
    locations.set(key, surfaces)
  }
  return locations
}

/** Ordered controls remain one list; qualify only ambiguous labels. */
export function labelUnitOptions<T extends SurfaceOption>(
  items: readonly T[],
): T[] {
  const locations = surfacesBy(items, item => item.label)
  return items.map(item => ({
    ...item,
    label:
      item.surfaceName && (locations.get(item.label)?.size ?? 0) > 1
        ? `${item.label} (${item.surfaceName})`
        : item.label,
  }))
}

export function groupUnitOptions<T extends SurfaceOption>(
  items: readonly T[],
): { id: string; label?: string; items: T[] }[] {
  const locations = surfacesBy(
    items,
    item => parseUnitLocator(item.value).baseType,
  )
  if (![...locations.values()].some(surfaces => surfaces.size > 1))
    return [{ id: '', items: [...items] }]

  const groups = new Map<
    string,
    { id: string; label?: string; order: number; items: T[] }
  >()
  for (const item of items) {
    const id = item.surfaceId ?? ''
    let group = groups.get(id)
    if (!group) {
      group = {
        id,
        label: item.surfaceName,
        order: item.surfaceOrder ?? -1,
        items: [],
      }
      groups.set(id, group)
    }
    group.items.push(item)
  }
  return [...groups.values()].sort((a, b) => a.order - b.order)
}
