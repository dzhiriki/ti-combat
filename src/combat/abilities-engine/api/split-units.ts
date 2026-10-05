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
 *  per unit variant, each listed planet takes its count in turn and `@space`
 *  entries stay back. Counts a variant's units can't fill take units of its
 *  base type left over (subtypes gained after setup). Units the list doesn't
 *  cover (or assigns to a planet that isn't invaded) go to the first planet.
 *  Returns the planets receiving units, in invasion order. */
export function splitUnits(
  ctx: AbilityCallContext,
  split: UnitList<number>,
  units: readonly UnitId[],
): [SurfaceId, UnitId[]][] {
  const planets = foughtPlanetIds(ctx.state)
  const pool = new Map<string, UnitId[]>()
  for (const id of units) {
    const type = ctx.api.own.getUnitVariantKey(id)
    if (type) pool.set(type, [...(pool.get(type) ?? []), id])
  }
  const assigned = new Map<SurfaceId, UnitId[]>(
    planets.map(planet => [planet, []]),
  )
  const missing: [string, number, UnitId[] | undefined][] = []
  for (const [key, count] of split) {
    const { unitType, surfaceId } = parseUnitLocator(key)
    if (!(count > 0) || surfaceId === undefined) continue
    const target = assigned.get(surfaceId)
    if (!target && surfaceId !== SPACE_SURFACE_ID) continue
    const taken = pool.get(unitType)?.splice(0, count) ?? []
    target?.push(...taken)
    if (taken.length < count)
      missing.push([unitType, count - taken.length, target])
  }
  for (const [unitType, count, target] of missing) {
    const base = parseUnitLocator(unitType).baseType
    let left = count
    for (const [type, ids] of pool) {
      if (left <= 0) break
      if (parseUnitLocator(type).baseType !== base) continue
      const taken = ids.splice(0, left)
      target?.push(...taken)
      left -= taken.length
    }
  }
  for (const ids of pool.values()) assigned.get(planets[0])?.push(...ids)
  return [...assigned].filter(([, ids]) => ids.length > 0)
}
