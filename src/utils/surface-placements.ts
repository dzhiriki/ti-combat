import {
  DEFAULT_UNIT_SURFACES,
  GROUND_FORCES,
  SHIPS,
  UNIT_LIMITS,
  UNIT_TYPES,
} from '@/constants/units'
import type {
  CombatSide,
  SurfaceDefinition,
  SurfaceId,
  SurfaceUnitCounts,
  SurfaceType,
  SurfaceUnitSelections,
  UnitBaseType,
  UnitSelection,
  UnitStats,
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

export function defaultSurfaceId(
  surfaces: readonly SurfaceDefinition[],
  activePlanetId: SurfaceId,
  side: CombatSide,
  type: UnitBaseType,
  stats?: UnitStats,
  preferredSurfaceType?: SurfaceType,
): SurfaceId {
  const allowed = allowedSurfaceTypes(type, stats)
  const defaultPreferred: SurfaceType =
    SHIPS.includes(type) ||
    (GROUND_FORCES.includes(type) && side === 'attacker')
      ? 'SPACE'
      : 'PLANET'
  const preferred = preferredSurfaceType ?? defaultPreferred
  const preferredType = allowed.includes(preferred) ? preferred : allowed[0]
  const active = surfaces.find(s => s.id === activePlanetId)
  if (preferredType === 'PLANET' && active?.type === 'PLANET') return active.id
  const destination = surfaces.find(s => s.type === preferredType)
  if (!destination) {
    throw new Error(`No legal ${preferredType} surface exists for ${type}`)
  }
  return destination.id
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
  spaceId: SurfaceId,
  planetId: SurfaceId,
  side: CombatSide,
  stats: Partial<Record<UnitBaseType, UnitStats>>,
  combatMode: 'SPACE' | 'GROUND',
): SurfaceUnitCounts {
  const next = createEmptySurfaceCounts(surfaces)
  for (const surface of surfaces) {
    if (current[surface.id]) next[surface.id] = { ...current[surface.id] }
  }
  next[spaceId] = Object.fromEntries(
    UNIT_TYPES.map(type => [type, 0]),
  ) as Record<UnitBaseType, number>
  next[planetId] = { ...next[spaceId] }
  for (const type of UNIT_TYPES) {
    const allowed = allowedSurfaceTypes(type, stats[type])
    const preferred: SurfaceType =
      (combatMode === 'SPACE' && allowed.includes('SPACE')) ||
      SHIPS.includes(type)
        ? 'SPACE'
        : 'PLANET'
    const destination = defaultSurfaceId(
      surfaces,
      planetId,
      side,
      type,
      stats[type],
      preferred,
    )
    next[destination][type] = totals[type].count
  }
  return next
}

export function normalizeSurfaceCounts(
  counts: SurfaceUnitCounts,
  surfaces: readonly SurfaceDefinition[],
  activePlanetId: SurfaceId,
  side: CombatSide,
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
      const destination = defaultSurfaceId(
        surfaces,
        activePlanetId,
        side,
        type,
        stats[type],
      )
      next[destination][type] += displaced
    }
  }
  return next
}
