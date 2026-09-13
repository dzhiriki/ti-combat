import type { UnitBaseType } from './unit'

export interface UnitSelection {
  count: number
  upgraded: boolean
}

export type SurfaceType = 'SPACE' | 'PLANET'
export type SurfaceId = string & { readonly __brand: 'SurfaceId' }

export interface SurfaceDefinition {
  id: SurfaceId
  type: SurfaceType
  name: string
}

export type SurfaceUnitSelections = Record<
  string,
  Record<UnitBaseType, UnitSelection>
>

export const SPACE_SURFACE_ID = 'space' as SurfaceId
export const DEFAULT_PLANET_ID = 'planet-1' as SurfaceId

export function createDefaultSurfaces(): SurfaceDefinition[] {
  return [
    { id: SPACE_SURFACE_ID, type: 'SPACE', name: 'Space' },
    { id: DEFAULT_PLANET_ID, type: 'PLANET', name: 'Planet 1' },
  ]
}
