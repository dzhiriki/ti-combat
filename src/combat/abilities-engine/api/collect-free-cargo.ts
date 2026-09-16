import { UNIT_TYPES } from '@/constants/units'
import type { UnitBaseType } from '@/types'

import type { SideApi } from './ability-api'

/** Carried unit types exempt from capacity because a LIVING unit on the side
 *  carries them free (`UnitStats.FREE_CARGO` — A Strangled Whisper's
 *  infantry/fighters). Recomputed per enforcement pass, so the exemption
 *  ends the moment the carrier dies. Shared by the capacity and fleet-pool
 *  drivers: free cargo neither consumes capacity nor spills into the fleet
 *  pool. */
export function collectFreeCargo(api: SideApi): ReadonlySet<UnitBaseType> {
  const free = new Set<UnitBaseType>()
  for (const baseType of UNIT_TYPES) {
    const cargo = api.getUnitStats(baseType)?.FREE_CARGO
    if (!cargo?.length) continue
    if (
      api.surface.countUnits(baseType, {
        includeVariants: true,
      }) === 0
    )
      continue
    for (const t of cargo) free.add(t)
  }
  return free
}
