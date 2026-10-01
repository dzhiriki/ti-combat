import type { Ability, AbilityReadContext } from '@/combat'
import { spendsUsesOnPlanet } from '@/combat/combat-state/planet-uses'
import type { SurfaceDefinition } from '@/types'

/** The planets an ability's limited uses can be capped on: every planet of
 *  a multi-planet invasion, for an ability that spends its uses on a
 *  planet. */
export function cappablePlanets(
  ability: Ability,
  params: Record<string, unknown>,
  ctx: AbilityReadContext,
): SurfaceDefinition[] | undefined {
  const invasion = ctx.state.invasion
  if (
    !invasion ||
    !spendsUsesOnPlanet(ability, params, {
      abilities: ctx.abilities,
      this: ability,
    })
  )
    return undefined
  return ctx.state.surfaces.filter(surface =>
    invasion.planets.includes(surface.id),
  )
}
