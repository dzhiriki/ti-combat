import { parseUnitLocator } from '@/combat/utils/parse-unit-locator'

export interface SurfaceOption {
  label: string
  value: string
  surfaceId?: string
  surfaceName?: string
  surfaceOrder?: number
}

/** Ordered controls remain one list; qualify only ambiguous labels. */
export function labelUnitOptions<T extends SurfaceOption>(
  items: readonly T[],
): T[] {
  const locations = new Map<string, Set<string>>()
  for (const item of items) {
    if (!item.surfaceId) continue
    const surfaces = locations.get(item.label) ?? new Set<string>()
    surfaces.add(item.surfaceId)
    locations.set(item.label, surfaces)
  }
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
  const locations = new Map<string, Set<string>>()
  for (const item of items) {
    if (!item.surfaceId) continue
    const type = parseUnitLocator(item.value).baseType
    const surfaces = locations.get(type) ?? new Set<string>()
    surfaces.add(item.surfaceId)
    locations.set(type, surfaces)
  }
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
