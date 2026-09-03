import { z } from 'zod/mini'

import { type Ability, declareParam } from '@/combat'
import type { UnitList } from '@/types'
import { UnitListSchema } from '@/types'

type Params = {
  targetPriority: UnitList
}

export const dimensionalSplicer: Ability<Params> = {
  key: 'DIMENSIONAL_SPLICER',
  name: 'Dimensional Splicer',
  description:
    "At the start of a space combat in a system that contains a wormhole and 1 or more of your ships, you may produce 1 hit and assign it to 1 of your opponent's ships.",
  context: 'SPACE',
  paramsSchema: z.object({
    targetPriority: UnitListSchema,
  }),
  params: {
    isEnabled: false,
    uses: Infinity,
    targetPriority: declareParam<UnitList>({
      default: [],
      source: 'ships',
      side: 'opponent',
      filter: { combatMode: 'SPACE' },
    }),
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'START_OF_COMBAT',
      isCallable: (params, ctx) => {
        return (
          ctx.api.opponent.findUnitByPriority(
            ctx.utils.getFlat(params.targetPriority),
            { includeVariants: false },
          ) !== undefined
        )
      },
      call: (ctx, params) => {
        const target = ctx.api.opponent.findUnitByPriority(
          ctx.utils.getFlat(params.targetPriority),
          { includeVariants: false },
        )!
        const type = ctx.api.opponent.getUnitBaseType(target)!

        ctx.api.opponent.addHits(1, [type])
      },
    },
  ],
  uiConfig: ctx => [
    {
      key: 'targetPriority',
      type: 'unit-list',
      mode: 'order',
      items: ctx.api.opponent.getUnitVariantsOptions('targetPriority'),
    },
  ],
}
