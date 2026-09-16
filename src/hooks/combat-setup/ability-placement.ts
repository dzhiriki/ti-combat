import type { RegisteredAbility, SideAbilitiesConfig } from '@/combat'
import type { SurfaceType, UnitBaseType, UnitStats } from '@/types'

export function getAbilityPlacementOverrides(
  abilities: readonly RegisteredAbility[],
  config: SideAbilitiesConfig,
): Partial<Record<UnitBaseType, readonly SurfaceType[]>> {
  const result: Partial<Record<UnitBaseType, readonly SurfaceType[]>> = {}

  for (const ability of abilities) {
    if (config[ability.key]?.isEnabled !== true) continue
    for (const placement of ability.unitPlacements ?? []) {
      result[placement.unitType] = placement.allowedSurfaces
    }
  }

  return result
}

/** Apply enabled abilities' setup-time placement permissions without
 *  applying their runtime stat changes before PREPARE. */
export function applyAbilityPlacementOverrides(
  stats: Record<string, UnitStats>,
  abilities: readonly RegisteredAbility[],
  config: SideAbilitiesConfig,
): Record<string, UnitStats> {
  let result = stats

  for (const [unitType, allowedSurfaces] of Object.entries(
    getAbilityPlacementOverrides(abilities, config),
  )) {
    if (result === stats) result = { ...stats }
    const current = result[unitType]
    if (!current) continue
    result[unitType] = {
      ...current,
      ALLOWED_SURFACES: allowedSurfaces,
    }
  }

  return result
}
