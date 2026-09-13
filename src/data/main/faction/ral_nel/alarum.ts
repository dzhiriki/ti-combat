import { z } from 'zod/mini'

import { type Ability, declareParam } from '@/combat'
import type { UnitId, UnitList, UnitType } from '@/types'
import { UnitListNumberSchema } from '@/types'

type Params = {
  availableUnits: UnitList<number>
}

declare global {
  interface AbilityConfigMap {
    ALARUM: Params
  }
}

export const alarum: Ability<Params> = {
  key: 'ALARUM',
  name: 'Alarum',
  description:
    'At the end of a round of ground combat on this planet, you may move up to 2 of your ground forces to this planet from planets in adjacent systems.',
  context: 'GROUND',
  paramsSchema: z.object({
    availableUnits: UnitListNumberSchema,
  }),
  params: {
    isEnabled: false,
    uses: Infinity,
    availableUnits: declareParam<UnitList<number>>({
      default: [] as UnitList<number>,
      defaultItemValue: 0,
      source: 'groundForces',
      sort: 'worth-desc',
      filter: {
        combatMode: 'GROUND',
        include: ['MECH', 'INFANTRY'],
        includeNonParticipating: true,
      },
      limit: 'EXTRA',
    }),
  },
  headerUI: 'isEnabled',
  uiConfig: ctx => [
    {
      key: 'availableUnits',
      type: 'unit-list',
      mode: 'number',
      sortable: true,
      items: ctx.api.own.getUnitVariantsOptions('availableUnits'),
    },
  ],
  invoke: [
    {
      timing: 'END_OF_COMBAT_ROUND',
      context: 'GROUND_COMBAT',
      isCallable: (params, ctx) => {
        if (!params.availableUnits.some(([, n]) => n > 0)) return false
        const callerId = ctx.getUnit()
        const state = (ctx.api.own.getRunState('ALARUM')?.firedRoundIds ??
          []) as UnitId[]
        return !state.includes(callerId)
      },
      call: (ctx, params) => {
        const callerId = ctx.getUnit()

        const PER_MECH_CAP = 2
        let placed = 0
        const placedIds: UnitId[] = []
        const updatedCounts = new Map<string, number>(params.availableUnits)

        for (const [variantKey, count] of params.availableUnits) {
          if (placed >= PER_MECH_CAP) break
          if (count <= 0) continue
          const toPlace = Math.min(count, PER_MECH_CAP - placed)

          const newIds = ctx.api.own.placeUnits({
            [variantKey]: toPlace,
          } as Partial<Record<UnitType, number>>)
          if (newIds[variantKey]) placedIds.push(...newIds[variantKey])

          updatedCounts.set(variantKey, count - toPlace)
          placed += toPlace
        }

        ctx.api.own.updateAbilityConfig({
          availableUnits: Array.from(
            updatedCounts.entries(),
          ) as UnitList<number>,
        })

        ctx.api.own.updateRunState({
          firedRoundIds: (current: UnitId[]) => [
            ...(current ?? []),
            callerId,
            ...placedIds,
          ],
        })

        if (placed > 0) {
          ctx.logger?.log(`Moved ${placed} ground forces from adjacent systems`)
        }
      },
    },
  ],
}
