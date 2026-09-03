import { z } from 'zod/mini'

import {
  type Ability,
  type AbilityCallContext,
  collectFreeCargo,
  parseVariantId,
} from '@/combat'
import { UNIT_TYPES } from '@/constants/units'
import type { UnitBaseType, UnitList, UnitType } from '@/types'
import { UnitListSchema } from '@/types'

type Params = {
  removePriority: UnitList
}

declare global {
  interface AbilityConfigMap {
    CAPACITY: Params
  }
}

export const capacity: Ability<Params> = {
  key: 'CAPACITY',
  name: 'Enforce Capacity',
  context: 'SPACE',
  paramsSchema: z.object({
    removePriority: UnitListSchema,
  }),
  params: {
    isEnabled: false,
    uses: Infinity,
    removePriority: [['FIGHTER'], ['INFANTRY'], ['MECH']] as UnitList,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'PREPARE',
      call: (ctx, params) => {
        enforceCapacity(ctx, ctx.utils.getFlat(params.removePriority))
      },
    },
    {
      timing: 'CLEANUP',
      context: ['SPACE_COMBAT', 'SPACE_CANNON_OFFENSE'],
      call: (ctx, params) => {
        enforceCapacity(ctx, ctx.utils.getFlat(params.removePriority))
      },
    },
  ],
  uiConfig: ctx => {
    const carriedBaseTypes = UNIT_TYPES.filter(t => {
      const stats = ctx.api.own.getUnitStats(t)
      return stats?.CAPACITY_COST != null
    })

    return [
      {
        key: 'removePriority',
        label: 'Removal Priority',
        type: 'unit-list',
        mode: 'order',
        items: ctx.api.own.getUnitVariantsOptions({
          include: carriedBaseTypes,
          includeNonParticipating: true,
        }),
      },
    ]
  },
}

/** Compute total ship capacity for a side */
export function computeTotalCapacity(ctx: AbilityCallContext): number {
  const api = ctx.api.own
  let totalCapacity = 0
  for (const baseType of UNIT_TYPES) {
    const stats = api.getUnitStats(baseType)
    if (!stats || stats.CAPACITY_COST != null) continue
    const cap = stats.CAPACITY
    if (cap == null || cap <= 0) continue
    // Skip zero-count types BEFORE multiplying: an infinite-capacity stat
    // (A Strangled Whisper) times a count of 0 would poison the total with
    // NaN once the carrier is destroyed.
    const count = api.countUnits(baseType, { includeVariants: true })
    if (count > 0) totalCapacity += cap * count
  }
  return totalCapacity
}

function enforceCapacity(
  ctx: AbilityCallContext,
  removePriority: UnitType[],
): void {
  const api = ctx.api.own

  const totalCapacity = computeTotalCapacity(ctx)
  const freeCargo = collectFreeCargo(api)

  // Collect carried units (CAPACITY_COST != null). Exempt from enforcement:
  // free cargo (a living carrier holds them free), and units with a fleet
  // pool fallback (Fighter II style) — their excess beyond capacity spills
  // into the fleet pool instead of forcing removals, and counting them here
  // would wrongly evict OTHER cargo (infantry) for an overflow that the
  // fleet-pool driver already prices in.
  const carriedTypes: {
    baseType: UnitBaseType
    cost: number
  }[] = []
  for (const baseType of UNIT_TYPES) {
    if (freeCargo.has(baseType)) continue
    const stats = api.getUnitStats(baseType)
    if (!stats || stats.CAPACITY_COST == null) continue
    if (typeof stats.FLEET_POOL_COST === 'number') continue
    const count = api.countUnits(baseType, { includeVariants: true })
    if (count === 0) continue
    carriedTypes.push({
      baseType,
      cost: stats.CAPACITY_COST,
    })
  }

  if (carriedTypes.length === 0) return

  // If no capacity at all, remove all (non-exempt) carried units
  if (totalCapacity === 0) {
    for (const { baseType } of carriedTypes) {
      const units = api.getUnits(baseType, { includeVariants: true })
      for (const unitId of units) {
        api.removeUnits(unitId)
      }
    }
    return
  }

  // Compute total cost
  let totalCost = 0
  for (const { baseType, cost } of carriedTypes) {
    totalCost += cost * api.countUnits(baseType, { includeVariants: true })
  }

  if (totalCost <= totalCapacity) return

  // Remove excess units by priority (exempt types are absent from
  // carriedTypes and skipped)
  let excess = totalCost - totalCapacity

  for (const priorityType of removePriority) {
    if (excess <= 0) break

    const { type: baseType } = parseVariantId(priorityType)
    const info = carriedTypes.find(
      c => c.baseType === baseType || c.baseType === priorityType,
    )
    if (!info) continue
    const stats = api.getUnitStats(baseType)
    if (!stats || stats.CAPACITY_COST == null) continue

    while (excess > 0) {
      const units = api.getUnits(priorityType, { includeVariants: false })
      if (units.length === 0) break
      api.removeUnits(units[0])
      excess -= stats.CAPACITY_COST
    }
  }
}
