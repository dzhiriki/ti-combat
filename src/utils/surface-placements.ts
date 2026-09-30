import {
  DEFAULT_UNIT_SURFACES,
  SHIPS,
  UNIT_LIMITS,
  UNIT_TYPES,
} from '@/constants/units'
import {
  SPACE_SURFACE_ID,
  type SurfaceDefinition,
  type SurfaceId,
  type SurfaceUnitCounts,
  type SurfaceType,
  type SurfaceUnitSelections,
  type UnitBaseType,
  type UnitSelection,
  type UnitStats,
} from '@/types'

export function createEmptyUnitSelections(): Record<
  UnitBaseType,
  UnitSelection
> {
  return Object.fromEntries(
    UNIT_TYPES.map(type => [type, { count: 0, upgraded: false }]),
  ) as Record<UnitBaseType, UnitSelection>
}

export function allowedSurfaceTypes(
  type: UnitBaseType,
  stats?: UnitStats,
): readonly SurfaceType[] {
  return stats?.ALLOWED_SURFACES ?? DEFAULT_UNIT_SURFACES[type]
}

/** Where a unit of `type` lands: the `preferred` surface type when allowed,
 *  else the first allowed one (the active planet for planets). */
export function defaultSurfaceId(
  activePlanetId: SurfaceId,
  type: UnitBaseType,
  stats?: UnitStats,
  preferred?: SurfaceType,
): SurfaceId {
  const allowed = allowedSurfaceTypes(type, stats)
  const target =
    preferred && allowed.includes(preferred) ? preferred : allowed[0]
  return target === 'PLANET' ? activePlanetId : SPACE_SURFACE_ID
}

/** The one surface the simplified editor puts units of `type` on: the combat
 *  mode's surface when allowed, and space for ships. */
export function simplifiedSurfaceId(
  planetId: SurfaceId,
  type: UnitBaseType,
  stats: UnitStats | undefined,
  combatMode: 'SPACE' | 'GROUND',
): SurfaceId {
  const allowed = allowedSurfaceTypes(type, stats)
  const preferred: SurfaceType =
    (combatMode === 'SPACE' && allowed.includes('SPACE')) ||
    SHIPS.includes(type)
      ? 'SPACE'
      : 'PLANET'
  return defaultSurfaceId(planetId, type, stats, preferred)
}

export function createEmptySurfaceCounts(
  surfaces: readonly SurfaceDefinition[],
): SurfaceUnitCounts {
  return Object.fromEntries(
    surfaces.map(surface => [
      surface.id,
      Object.fromEntries(UNIT_TYPES.map(type => [type, 0])),
    ]),
  ) as SurfaceUnitCounts
}

export function materializeSurfaceSelections(
  counts: SurfaceUnitCounts,
  upgrades: ReadonlySet<UnitBaseType>,
): SurfaceUnitSelections {
  return Object.fromEntries(
    Object.entries(counts).map(([surfaceId, byType]) => [
      surfaceId,
      Object.fromEntries(
        UNIT_TYPES.map(type => [
          type,
          { count: byType[type] ?? 0, upgraded: upgrades.has(type) },
        ]),
      ),
    ]),
  ) as SurfaceUnitSelections
}

export function collapseSurfaceCounts(
  counts: SurfaceUnitCounts,
  upgrades: ReadonlySet<UnitBaseType>,
  surfaces: readonly SurfaceId[],
): Record<UnitBaseType, UnitSelection> {
  const result = createEmptyUnitSelections()
  for (const type of UNIT_TYPES) result[type].upgraded = upgrades.has(type)
  for (const surfaceId of surfaces) {
    const byType = counts[surfaceId]
    if (!byType) continue
    for (const type of UNIT_TYPES) result[type].count += byType[type] ?? 0
  }
  return result
}

export function expandSimplifiedCounts(
  current: SurfaceUnitCounts,
  totals: Record<UnitBaseType, UnitSelection>,
  surfaces: readonly SurfaceDefinition[],
  planetId: SurfaceId,
  stats: Partial<Record<UnitBaseType, UnitStats>>,
  combatMode: 'SPACE' | 'GROUND',
): SurfaceUnitCounts {
  const next = createEmptySurfaceCounts(surfaces)
  for (const surface of surfaces) {
    if (current[surface.id]) next[surface.id] = { ...current[surface.id] }
  }
  next[SPACE_SURFACE_ID] = Object.fromEntries(
    UNIT_TYPES.map(type => [type, 0]),
  ) as Record<UnitBaseType, number>
  next[planetId] = { ...next[SPACE_SURFACE_ID] }
  for (const type of UNIT_TYPES) {
    next[simplifiedSurfaceId(planetId, type, stats[type], combatMode)][type] =
      totals[type].count
  }
  return next
}

export function normalizeSurfaceCounts(
  counts: SurfaceUnitCounts,
  surfaces: readonly SurfaceDefinition[],
  activePlanetId: SurfaceId,
  stats: Partial<Record<UnitBaseType, UnitStats>>,
): SurfaceUnitCounts {
  const next = createEmptySurfaceCounts(surfaces)
  for (const type of UNIT_TYPES) {
    let remaining = UNIT_LIMITS[type]
    let displaced = 0
    const allowed = allowedSurfaceTypes(type, stats[type])
    for (const surface of surfaces) {
      const requested = counts[surface.id]?.[type] ?? 0
      const count = Math.min(Math.max(0, requested), remaining)
      remaining -= count
      if (allowed.includes(surface.type)) next[surface.id][type] += count
      else displaced += count
    }
    if (displaced > 0) {
      next[defaultSurfaceId(activePlanetId, type, stats[type])][type] +=
        displaced
    }
  }
  return next
}
