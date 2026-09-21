import { z } from 'zod/mini'

import { type Ability, declareParam } from '@/combat'
import type { UnitId, UnitList } from '@/types'
import { UnitListBooleanSchema } from '@/types'

/** Fires with the UnitId of the infantry swapped in by Indoctrination. */
declare global {
  interface TimingContextMap {
    WHEN_INDOCTRINATION: UnitId
  }
}

type Params = {
  targetPriority: UnitList<boolean>
}

export const indoctrination: Ability<Params> = {
  key: 'INDOCTRINATION',
  name: 'Indoctrination',
  description:
    "At the start of a ground combat, you may spend 2 influence to replace 1 of your opponent's participating infantry with 1 infantry from your reinforcements.",
  context: 'GROUND',
  paramsSchema: z.object({
    targetPriority: UnitListBooleanSchema,
  }),
  params: {
    isEnabled: false,
    uses: Infinity,
    targetPriority: declareParam<UnitList<boolean>>({
      default: [],
      source: 'groundForces',
      side: 'opponent',
      defaultItemValue: true,
      sort: 'worth-desc',
      filter: { include: ['INFANTRY'], combatMode: 'GROUND' },
    }),
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'START_OF_COMBAT',
      isCallable: (params, ctx) =>
        ctx.api.opponent.findUnitByPriority(
          ctx.utils.getFlat(params.targetPriority),
          { includeVariants: false },
        ) !== undefined,
      call: (ctx, params) => {
        const target = ctx.api.opponent.findUnitByPriority(
          ctx.utils.getFlat(params.targetPriority),
          { includeVariants: false },
        )
        if (target === undefined) return
        ctx.api.opponent.removeUnits(target)
        const [placedId] = ctx.api.own.placeUnits({ INFANTRY: 1 }).INFANTRY
        ctx.trigger('WHEN_INDOCTRINATION', placedId)
      },
    },
  ],
  uiConfig: ctx => {
    const items = ctx.api.opponent.getUnitVariantsOptions('targetPriority')

    return [
      {
        key: 'targetPriority',
        type: 'unit-list',
        mode: 'checkbox',
        sortable: true,
        items,
        visible: items.length > 1,
      },
    ]
  },
}
