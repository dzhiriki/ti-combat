import type { AbilityLayoutContext, SurfaceDefinition } from '@/types'

/** The ability layout context of a system with these surfaces. */
export function layoutContext(
  surfaces: readonly SurfaceDefinition[],
): AbilityLayoutContext {
  return {
    planets: surfaces.filter(surface => surface.type === 'PLANET').length,
  }
}
