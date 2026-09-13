import { z } from 'zod/mini'

import { type Ability, declareParam } from '@/combat'
import type { UnitList } from '@/types'
import { UnitListSchema } from '@/types'

type Params = {
  targetPriority: UnitList
}

export const magenDefenseGrid: Ability<Params> = {
  key: 'MAGEN_DEFENSE_GRID',
  name: 'Magen Defense Grid',
  description:
    "At the start of ground combat on a planet that contains 1 or more of your structures, produce 1 hit and assign it to 1 of your opponent's ground forces.",
  context: 'GROUND',
  paramsSchema: z.object({
    targetPriority: UnitListSchema,
  }),
  params: {
    isEnabled: false,
    uses: Infinity,
    targetPriority: declareParam<UnitList>({
      default: [],
      source: 'groundForces',
      side: 'opponent',
      filter: { combatMode: 'GROUND' },
    }),
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'START_OF_COMBAT',
      isCallable: (_, ctx) => {
        const { structures } = ctx.api.own.getAbilityConfig('SETTINGS')
        return ctx.api.own.countUnits(structures, { includeVariants: true }) > 0
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
