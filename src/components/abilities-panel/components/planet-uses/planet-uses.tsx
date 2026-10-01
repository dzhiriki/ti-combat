import { type Ability, extractDefaults } from '@/combat'
import type { UIConfigItem } from '@/combat/abilities-engine/types'
import type { PlanetUsesParam } from '@/combat/combat-state/planet-uses'
import type { SurfaceDefinition, SurfaceId } from '@/types'

import { List } from '../list'

type PlanetUsesValue = [SurfaceId, number][]

/** One use the player can't change: a planet either uses the ability or
 *  not. `items` are the ability's resolved config items. */
export function hasFixedSingleUse(
  ability: Ability,
  items: readonly UIConfigItem[] | undefined,
): boolean {
  const editable =
    ability.headerUI === 'uses' || !!items?.some(item => item.key === 'uses')
  return !editable && extractDefaults(ability).uses === 1
}

export function planetUsesTitle(singleUse: boolean): string {
  return singleUse ? 'Use on planets' : 'Uses per planet'
}

interface PlanetUsesProps {
  planets: readonly SurfaceDefinition[]
  uses: number
  /** A fixed single use: each planet may use it or not. */
  singleUse: boolean
  value: PlanetUsesParam | undefined
  onChange: (value: PlanetUsesValue) => void
}

/** How many of an ability's uses each invaded planet may spend; a planet
 *  without a cap is not limited. A fixed single use is allowed or not per
 *  planet. */
export function PlanetUses({
  planets,
  uses,
  singleUse,
  value = [],
  onChange,
}: PlanetUsesProps) {
  const items = planets.map(planet => ({
    label: planet.name,
    value: planet.id,
    max: uses,
  }))

  if (singleUse) {
    const blocked = new Set(
      value.filter(([, cap]) => cap === 0).map(([planet]) => planet),
    )
    return (
      <List
        mode="checkbox"
        items={items}
        value={planets.map(({ id }) => [id, !blocked.has(id)])}
        onChange={next =>
          onChange(
            next
              .filter(([, allowed]) => !allowed)
              .map(([planet]) => [planet as SurfaceId, 0]),
          )
        }
      />
    )
  }

  return (
    <List
      mode="number"
      optional
      items={items}
      value={value as PlanetUsesValue}
      onChange={next => onChange(next as PlanetUsesValue)}
    />
  )
}
