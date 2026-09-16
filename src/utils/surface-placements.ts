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

export function createEmptySurfaceSelections(
  surfaces: readonly SurfaceDefinition[],
): SurfaceUnitSelections {
  return Object.fromEntries(
    surfaces.map(surface => [surface.id, createEmptyUnitSelections()]),
  )
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

export function collapseVisibleSurfaces(
  placements: SurfaceUnitSelections,
  spaceId: SurfaceId,
  planetId: SurfaceId,
): Record<UnitBaseType, UnitSelection> {
  const result = createEmptyUnitSelections()
  for (const surfaceId of [spaceId, planetId]) {
    const surface = placements[surfaceId]
    if (!surface) continue
    for (const type of UNIT_TYPES) {
      result[type].count += surface[type]?.count ?? 0
      result[type].upgraded ||= surface[type]?.upgraded ?? false
    }
  }
  return result
}

export function collapseAllSurfaces(
  placements: SurfaceUnitSelections,
): Record<UnitBaseType, UnitSelection> {
  const result = createEmptyUnitSelections()
  for (const selections of Object.values(placements)) {
    for (const type of UNIT_TYPES) {
      result[type].count += selections[type]?.count ?? 0
      result[type].upgraded ||= selections[type]?.upgraded ?? false
    }
  }
  return result
}

export function expandSimplifiedSelections(
  current: SurfaceUnitSelections,
  selections: Record<UnitBaseType, UnitSelection>,
  surfaces: readonly SurfaceDefinition[],
  spaceId: SurfaceId,
  planetId: SurfaceId,
  side: CombatSide,
  stats: Partial<Record<UnitBaseType, UnitStats>>,
  combatMode: 'SPACE' | 'GROUND',
): SurfaceUnitSelections {
  const next: SurfaceUnitSelections = {}
  for (const surface of surfaces) {
    const source = current[surface.id]
    next[surface.id] = source
      ? (Object.fromEntries(
          UNIT_TYPES.map(type => [type, { ...source[type] }]),
        ) as Record<UnitBaseType, UnitSelection>)
      : createEmptyUnitSelections()
  }

  next[spaceId] = createEmptyUnitSelections()
  next[planetId] = createEmptyUnitSelections()
  for (const type of UNIT_TYPES) {
    const selection = selections[type]
    const preferredSurfaceType: SurfaceType =
      SHIPS.includes(type) ||
      (GROUND_FORCES.includes(type) && combatMode === 'SPACE')
        ? 'SPACE'
        : 'PLANET'
    const destination = defaultSurfaceId(
      surfaces,
      planetId,
      side,
      type,
      stats[type],
      preferredSurfaceType,
    )
    next[destination][type] = { ...selection }
    for (const surface of surfaces) {
      next[surface.id][type].upgraded = selection.upgraded
    }
  }
  return next
}

export function normalizeSurfaceSelections(
  placements: SurfaceUnitSelections,
  surfaces: readonly SurfaceDefinition[],
  activePlanetId: SurfaceId,
  side: CombatSide,
  stats: Partial<Record<UnitBaseType, UnitStats>>,
): SurfaceUnitSelections {
  const next = createEmptySurfaceSelections(surfaces)
  for (const type of UNIT_TYPES) {
    let remaining = UNIT_LIMITS[type]
    let upgraded = false
    let displaced = 0
    const allowed = allowedSurfaceTypes(type, stats[type])
    for (const surface of surfaces) {
      const selection = placements[surface.id]?.[type]
      if (!selection) continue
      upgraded ||= selection.upgraded
      const count = Math.min(Math.max(0, selection.count), remaining)
      remaining -= count
      if (allowed.includes(surface.type)) next[surface.id][type].count += count
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
      next[destination][type].count += displaced
    }
    for (const surface of surfaces) next[surface.id][type].upgraded = upgraded
  }
  return next
}
