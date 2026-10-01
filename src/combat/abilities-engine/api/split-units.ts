import {
  SPACE_SURFACE_ID,
  type SurfaceId,
  type UnitId,
  type UnitList,
} from '@/types'

import { parseUnitLocator } from '../../utils/parse-unit-locator'
import type { AbilityCallContext } from '../types'
import { foughtPlanetIds } from '../unit-options'

/** Divide `units` between the invaded planets as a split param lists them:
 *  per unit type, each listed planet takes its count in turn and `@space`
 *  entries stay back. Units the list doesn't cover (or assigns to a planet
 *  that isn't invaded) go to the first planet. Returns the planets receiving
 *  units, in invasion order. */
export function splitUnits(
  ctx: AbilityCallContext,
  split: UnitList<number>,
  units: readonly UnitId[],
): [SurfaceId, UnitId[]][] {
  const planets = foughtPlanetIds(ctx.state)
  const pool = new Map<string, UnitId[]>()
  for (const id of units) {
    const type = ctx.api.own.getUnitBaseType(id)
    if (type) pool.set(type, [...(pool.get(type) ?? []), id])
  }
  const assigned = new Map<SurfaceId, UnitId[]>(
    planets.map(planet => [planet, []]),
  )
  for (const [key, count] of split) {
    const { baseType, surfaceId } = parseUnitLocator(key)
    const ids = pool.get(baseType)
    if (!ids || !(count > 0) || surfaceId === undefined) continue
    const target = assigned.get(surfaceId)
    if (!target && surfaceId !== SPACE_SURFACE_ID) continue
    const taken = ids.splice(0, count)
    target?.push(...taken)
  }
  for (const ids of pool.values()) assigned.get(planets[0])?.push(...ids)
  return [...assigned].filter(([, ids]) => ids.length > 0)
}
