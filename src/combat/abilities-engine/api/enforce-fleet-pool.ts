import type { UnitBaseType } from '@/types'

import type { SideApi } from './ability-api'
import { abilityUtils } from './ability-utils'
import { collectFreeCargo } from './collect-free-cargo'

/** Remove ships in excess of the side's fleet pool (the FLEET_POOL ability's
 *  PREPARE enforcement). Also re-run by the engine after `placeUnits`, so
 *  ships placed mid-combat are subject to the same limit. No-op when the
 *  FLEET_POOL ability is disabled. */
export function enforceFleetPool(api: SideApi): void {
  const config = api.getAbilityConfig('FLEET_POOL')
  if (!config?.isEnabled) return

  const { fleetPool, shipPriority } = config
  const spaceId = api.getSpaceSurfaceId()

  // Types riding free on a living carrier (A Strangled Whisper) neither
  // consume capacity nor spill into the fleet pool.
  const freeCargo = collectFreeCargo(api)

  // "Fighters in excess of your ships' capacity count against your fleet
  // pool" — the excess is measured against the ships' printed capacity from
  // the stats, independent of whether the CAPACITY enforcement toggle is on
  // (the toggle controls removal of illegal cargo, not how much capacity
  // the ships actually have).
  const settings = api.getAbilityConfig('SETTINGS')
  const allTypes = [
    ...settings.ships,
    ...settings.groundForces,
    ...settings.structures,
  ]

  let totalCapacity = 0
  for (const baseType of allTypes) {
    const stats = api.getUnitStats(baseType)
    if (!stats || stats.CAPACITY_COST != null) continue
    const cap = stats.CAPACITY
    if (cap == null || cap <= 0) continue
    const count = api.countUnits(baseType, {
      includeVariants: true,
      surfaceId: spaceId,
    })
    if (count > 0) totalCapacity += cap * count
  }

  // Capacity used by units WITHOUT fleet pool fallback — they claim their
  // share first (player-optimal: carried units that CAN spill into the
  // fleet pool yield the capacity to the ones that can't).
  let capacityUsedByNonFP = 0
  for (const baseType of allTypes) {
    if (freeCargo.has(baseType)) continue
    const stats = api.getUnitStats(baseType)
    if (
      !stats ||
      stats.CAPACITY_COST == null ||
      typeof stats.FLEET_POOL_COST === 'number'
    )
      continue
    capacityUsedByNonFP +=
      stats.CAPACITY_COST *
      api.countUnits(baseType, {
        includeVariants: true,
        surfaceId: spaceId,
      })
  }

  const remainingCapacity = Math.max(0, totalCapacity - capacityUsedByNonFP)

  // Sum fleet pool cost across all units using FLEET_POOL_COST stat
  let totalCost = 0
  const activeTypes = api.getActiveBaseTypes(spaceId)
  for (const baseType of activeTypes) {
    const stats = api.getUnitStats(baseType)
    if (typeof stats?.FLEET_POOL_COST !== 'number') continue

    const count = api.countUnits(baseType, {
      includeVariants: true,
      surfaceId: spaceId,
    })

    if (stats.CAPACITY_COST != null) {
      // Unit has both costs — only excess beyond capacity counts
      // Riding free on a living carrier → never in excess of capacity
      if (freeCargo.has(baseType)) continue
      const carriedCost = stats.CAPACITY_COST * count
      const excessCost = Math.max(0, carriedCost - remainingCapacity)
      const excessCount = Math.ceil(excessCost / stats.CAPACITY_COST)
      totalCost += excessCount * stats.FLEET_POOL_COST
    } else {
      totalCost += count * stats.FLEET_POOL_COST
    }
  }

  let excess = totalCost - fleetPool
  if (excess <= 0) return

  // Build removal order: unlisted types with cost first, then listed in reverse priority
  const priorityKeys = abilityUtils.getFlat(shipPriority)
  const prioritySet = new Set(priorityKeys)
  const typesWithCost = activeTypes.filter(t => {
    const stats = api.getUnitStats(t)
    return typeof stats?.FLEET_POOL_COST === 'number'
  })
  const unlisted = typesWithCost.filter(t => !prioritySet.has(t))
  const removalOrder = [
    ...unlisted,
    ...[...priorityKeys]
      .reverse()
      .filter(t => typesWithCost.includes(t as UnitBaseType)),
  ]

  for (const type of removalOrder) {
    if (excess <= 0) break
    const stats = api.getUnitStats(type)
    if (typeof stats?.FLEET_POOL_COST !== 'number') continue
    const cost = stats.FLEET_POOL_COST
    const unitCount = api.countUnits(type as UnitBaseType, {
      includeVariants: true,
      surfaceId: spaceId,
    })
    const toRemove = Math.min(Math.ceil(excess / cost), unitCount)
    for (let i = 0; i < toRemove; i++) {
      const id = api.getUnits(type as UnitBaseType, {
        includeVariants: true,
        surfaceId: spaceId,
      })[0]
      if (!id) break
      api.removeUnits(id)
      excess -= cost
    }
  }
}
