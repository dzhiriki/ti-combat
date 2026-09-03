import { z } from 'zod/mini'

import { type Ability, declareParam } from '@/combat'
import type { UnitBaseType, UnitList, UnitType } from '@/types'
import { UnitListNumberSchema } from '@/types'

type Params = {
  strategy: 'IMMEDIATELY' | 'ENOUGH_FLEET_POOL'
  ships: UnitList<number, UnitBaseType>
}

export const overwingZeta: Ability<Params> = {
  key: 'OVERWING_ZETA',
  name: 'Overwing Zeta',
  description:
    'At the start of a round of space combat in a system that contains a planet you control: Place your flagship and up to a total of 2 cruisers or destroyers from your reinforcements in the active system.',
  context: 'SPACE',
  paramsSchema: z.object({
    strategy: z.string(),
    ships: UnitListNumberSchema,
  }),
  params: {
    isEnabled: false,
    uses: 1,
    strategy: 'IMMEDIATELY',
    ships: declareParam({
      // Default to the on-card maximum — the flagship plus 2 cruisers — so
      // enabling the card does something without further configuration.
      // Shared by the TF paradigm rebrand (Artemiris Ascendant).
      default: [
        ['FLAGSHIP', 1],
        ['CRUISER', 2],
      ],
      source: 'ships',
      defaultItemValue: 0,
      filter: {
        include: ['FLAGSHIP', 'CRUISER', 'DESTROYER'],
        combatMode: 'SPACE',
        includeOnlyBaseTypes: true,
      },
      limit: 'UNIT_LIMIT',
    }),
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'START_OF_COMBAT_ROUND',
      isCallable: (params, ctx) => {
        const toPlace = getShipsToPlace(ctx.utils.getRecord(params.ships))
        if (Object.keys(toPlace).length === 0) return false

        if (params.strategy === 'ENOUGH_FLEET_POOL') {
          const config = ctx.api.own.getAbilityConfig('FLEET_POOL')
          if (!config?.isEnabled) return true
          const fleetPool = config.fleetPool as number

          // Sum current fleet pool cost
          let currentCost = 0
          for (const baseType of ctx.api.own.getActiveBaseTypes()) {
            const stats = ctx.api.own.getUnitStats(baseType)
            if (typeof stats?.FLEET_POOL_COST !== 'number') continue
            const count = ctx.api.own.countUnits(baseType, {
              includeVariants: true,
            })
            currentCost += count * stats.FLEET_POOL_COST
          }

          // Sum cost of ships to place
          let addingCost = 0
          for (const [type, n] of Object.entries(toPlace)) {
            const stats = ctx.api.own.getUnitStats(type)
            if (typeof stats?.FLEET_POOL_COST === 'number') {
              addingCost += n * stats.FLEET_POOL_COST
            }
          }

          return currentCost + addingCost <= fleetPool
        }

        return true
      },
      call: (ctx, params) => {
        const toPlace = getShipsToPlace(ctx.utils.getRecord(params.ships))
        ctx.api.own.placeUnits(toPlace)
      },
    },
  ],
  uiConfig: ctx => [
    {
      key: 'strategy',
      label: 'Strategy',
      type: 'select',
      items: [
        { label: 'Immediately (R1)', value: 'IMMEDIATELY' },
        { label: 'Enough Fleet Pool', value: 'ENOUGH_FLEET_POOL' },
      ],
    },
    {
      key: 'ships',
      label: 'Ships',
      type: 'unit-list',
      mode: 'number',
      items: ctx.api.own.getUnitVariantsOptions('ships'),
    },
  ],
}

function getShipsToPlace(counts: Record<UnitType, number>) {
  const toPlace: Partial<Record<UnitBaseType, number>> = {}
  const flagship = Math.min(counts.FLAGSHIP ?? 0, 1)
  if (flagship > 0) toPlace.FLAGSHIP = flagship

  const cruisers = counts.CRUISER ?? 0
  const destroyers = counts.DESTROYER ?? 0
  let remaining = 2
  const clampedCruisers = Math.min(cruisers, remaining)
  remaining -= clampedCruisers
  const clampedDestroyers = Math.min(destroyers, remaining)

  if (clampedCruisers > 0) toPlace.CRUISER = clampedCruisers
  if (clampedDestroyers > 0) toPlace.DESTROYER = clampedDestroyers

  return toPlace
}
