import { z } from 'zod/mini'

import { type Ability, declareParam } from '@/combat'
import type { UnitList } from '@/types'
import { UnitListBooleanSchema } from '@/types'

type Params = {
  sacrificePriority: UnitList<boolean>
  targetPriority: UnitList<boolean>
}

export const devotion: Ability<Params> = {
  key: 'DEVOTION',
  name: 'Devotion',
  description:
    "After each space battle round, you may destroy 1 of your cruisers or destroyers in the active system to produce 1 hit and assign it to 1 of your opponent's ships in that system.",
  context: 'SPACE',
  paramsSchema: z.object({
    sacrificePriority: UnitListBooleanSchema,
    targetPriority: UnitListBooleanSchema,
  }),
  params: {
    isEnabled: false,
    uses: Infinity,
    sacrificePriority: declareParam({
      default: [] as UnitList<boolean>,
      source: 'ships',
      side: 'own',
      defaultItemValue: true,
      filter: { include: ['CRUISER', 'DESTROYER'], combatMode: 'SPACE' },
    }),
    targetPriority: declareParam<UnitList<boolean>>({
      default: [],
      source: 'ships',
      side: 'opponent',
      defaultItemValue: true,
      filter: { combatMode: 'SPACE' },
    }),
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'END_OF_COMBAT_ROUND',
      isCallable: (params, ctx) => {
        const sacrifice = ctx.api.own.findUnitByPriority(
          ctx.utils.getFlat(params.sacrificePriority),
          { includeVariants: false },
        )
        const target = ctx.api.opponent.findUnitByPriority(
          ctx.utils.getFlat(params.targetPriority),
          { includeVariants: false },
        )
        if (sacrifice === undefined) return false
        if (target === undefined) return false
        return true
      },
      call: (ctx, params) => {
        const sacrifice = ctx.api.own.findUnitByPriority(
          ctx.utils.getFlat(params.sacrificePriority),
          { includeVariants: false },
        )
        const target = ctx.api.opponent.findUnitByPriority(
          ctx.utils.getFlat(params.targetPriority),
          { includeVariants: false },
        )
        if (sacrifice === undefined) return
        if (target === undefined) return

        ctx.api.opponent.addHits(1, [
          ctx.api.opponent.getUnitVariantKey(target)!,
        ])
        ctx.api.own.destroyUnits(sacrifice)
        return
      },
    },
  ],
  uiConfig: ctx => {
    return [
      {
        key: 'sacrificePriority',
        label: 'Sacrifice Priority',
        type: 'unit-list',
        mode: 'checkbox',
        sortable: true,
        items: ctx.api.own.getUnitVariantsOptions('sacrificePriority'),
      },
      {
        key: 'targetPriority',
        label: 'Target Priority',
        type: 'unit-list',
        mode: 'checkbox',
        sortable: true,
        items: ctx.api.opponent.getUnitVariantsOptions('targetPriority'),
      },
    ]
  },
}
