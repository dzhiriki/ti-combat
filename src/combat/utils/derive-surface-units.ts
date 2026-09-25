import type { UnitIdList } from '@/types'

import type { SideStateData } from '../combat-state/types'

/**
 * Rebuild `surfaceUnits` from the id lists and `unitSurface`. Every surface
 * key of `previous` is kept, so emptied surfaces stay listed; each pool
 * holds its living units in `participatingUnits + nonParticipatingUnits`
 * order.
 */
export function deriveSurfaceUnits(
  side: Pick<
    SideStateData,
    'participatingUnits' | 'nonParticipatingUnits' | 'unitSurface'
  >,
  previous: Readonly<Record<string, UnitIdList>>,
): Record<string, UnitIdList> {
  const pools: Record<string, string> = {}
  for (const surfaceId in previous) pools[surfaceId] = ''
  const add = (ids: string) => {
    for (const id of ids) {
      const surfaceId = side.unitSurface[id]
      if (surfaceId !== undefined)
        pools[surfaceId] = (pools[surfaceId] ?? '') + id
    }
  }
  add(side.participatingUnits)
  add(side.nonParticipatingUnits)
  return pools as Record<string, UnitIdList>
}
