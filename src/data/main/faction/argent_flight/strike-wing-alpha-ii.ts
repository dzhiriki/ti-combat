import { z } from 'zod/mini'

import { type Ability, declareParam } from '@/combat'
import type { UnitId, UnitList } from '@/types'
import { UnitListBooleanSchema } from '@/types'

type Params = {
  targetPriority: UnitList<boolean>
}

declare global {
  interface AbilityConfigMap {
    STRIKE_WING_ALPHA_II: Params
  }
}

export const strikeWingAlphaII: Ability<Params> = {
  key: 'STRIKE_WING_ALPHA_II',
  name: 'Strike Wing Alpha II',
  description:
    "When this unit uses Anti-Fighter Barrage, each result of 9 or 10 also destroys 1 of your opponent's infantry in the space area of the active system.",
  context: 'SPACE',
  paramsSchema: z.object({
    targetPriority: UnitListBooleanSchema,
  }),
  params: {
    isEnabled: true,
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
      timing: 'BEFORE_UNIT_ABILITY_ROLL',
      context: 'AFB',
      declaration: true,
      call: (ctx, params) => {
        ctx.api.own.declareRollTrigger({
          unitType: [ctx.api.own.getUnitVariantKey(ctx.getUnit())!],
          faces: [9, 10],
          effect: (count, branchCtx) => {
            const flat = branchCtx.utils.getFlat(params.targetPriority)
            const toDestroy: UnitId[] = []
            for (const variant of flat) {
              if (toDestroy.length >= count) break
              const ids = branchCtx.api.opponent.getUnits(variant, {
                includeVariants: false,
              })
              for (const id of ids) {
                if (toDestroy.length >= count) break
                toDestroy.push(id)
              }
            }
            if (toDestroy.length === 0) return
            branchCtx.api.opponent.destroyUnits(toDestroy)
          },
        })
      },
    },
  ],
  uiConfig: ctx => {
    const items = ctx.api.opponent.getUnitVariantsOptions('targetPriority')

    if (items.length <= 1) return []

    return [
      {
        key: 'targetPriority',
        type: 'unit-list',
        mode: 'checkbox',
        sortable: true,
        items,
      },
    ]
  },
}
