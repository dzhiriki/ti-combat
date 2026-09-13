import { z } from 'zod/mini'

import { type Ability, declareParam } from '@/combat'
import type { UnitList } from '@/types'
import { UnitListSchema } from '@/types'

type Params = {
  shipPriority: UnitList
}

export const gravleashManeuvers: Ability<Params> = {
  key: 'GRAVLEASH_MANEUVERS',
  name: 'Gravleash Maneuvers',
  description:
    "Before you roll dice during space combat, apply +X to the results of 1 of your ship's rolls, where X is the number of ship types you have in the combat.",
  context: 'SPACE',
  paramsSchema: z.object({
    shipPriority: UnitListSchema,
  }),
  params: {
    isEnabled: false,
    uses: Infinity,
    shipPriority: declareParam<UnitList>({
      default: [],
      source: 'ships',
      sort: 'worth-desc',
      filter: { combatMode: 'SPACE' },
    }),
  },
  headerUI: 'isEnabled',
  uiConfig: ctx => [
    {
      key: 'shipPriority',
      type: 'unit-list',
      mode: 'order',
      items: ctx.api.own.getUnitVariantsOptions('shipPriority'),
    },
  ],
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      call: (ctx, params) => {
        const shipTypeCount = ctx.api.own
          .getParticipatingUnitTypes()
          .filter(unitType =>
            ctx.api.own.hasUnitType(unitType, {
              includeVariants: true,
            }),
          ).length

        const target = ctx.api.own.findUnitByPriority(
          ctx.utils.getFlat(params.shipPriority),
          { includeVariants: false },
        )
        if (shipTypeCount <= 0 || target === undefined) return
        const variantKey = ctx.api.own.getUnitVariantKey(target)
        if (!variantKey) return
        ctx.api.own.applyBonusToResult(shipTypeCount, {
          singleUnit: variantKey,
        })
      },
    },
  ],
}
