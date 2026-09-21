import { z } from 'zod/mini'

import { type Ability, declareParam } from '@/combat'
import { UNIT_LIMITS } from '@/constants/units'
import type { UnitId, UnitList } from '@/types'
import { UnitListBooleanSchema } from '@/types'

type Params = {
  sacrificePriority: UnitList<boolean>
  targetPriority: UnitList<boolean>
}

export const exotrireme: Ability<Params> = {
  key: 'EXOTRIREME',
  name: 'Exotrireme II',
  description:
    'This unit cannot be destroyed by Direct Hit action cards. After a round of space combat, you may destroy this unit to destroy up to 2 ships in this system.',
  context: 'SPACE',
  paramsSchema: z.object({
    sacrificePriority: UnitListBooleanSchema,
    targetPriority: UnitListBooleanSchema,
  }),
  params: {
    isEnabled: false,
    uses: 0,
    sacrificePriority: declareParam({
      default: [] as UnitList<boolean>,
      source: 'ships',
      side: 'own',
      defaultItemValue: true,
      filter: { include: ['DREADNOUGHT'], combatMode: 'SPACE' },
    }),
    targetPriority: declareParam<UnitList<boolean>>({
      default: [],
      source: 'ships',
      side: 'opponent',
      sort: 'worth-desc',
      defaultItemValue: true,
      filter: { combatMode: 'SPACE' },
    }),
  },
  headerUI: 'isEnabled',
  sort: (params, ctx, unitIds) => {
    const remaining = new Set(unitIds)
    const result: UnitId[] = []
    for (const variantId of ctx.utils.getFlat(params.sacrificePriority)) {
      for (const id of ctx.api.own.getUnits(variantId, {
        includeVariants: false,
      })) {
        if (remaining.has(id)) {
          result.push(id)
          remaining.delete(id)
        }
      }
    }
    for (const id of unitIds) {
      if (remaining.has(id)) result.push(id)
    }
    return result
  },
  invoke: [
    {
      timing: 'AFTER_COMBAT_ROUND',
      isCallable: (params, ctx) => {
        if (
          ctx.api.opponent.findUnitByPriority(
            ctx.utils.getFlat(params.targetPriority),
            { includeVariants: false },
          ) === undefined
        ) {
          return false
        }
        const variantKey = ctx.api.own.getUnitVariantKey(ctx.getUnit())
        return (
          variantKey !== undefined &&
          ctx.utils.getFlat(params.sacrificePriority).includes(variantKey)
        )
      },
      call: (ctx, params) => {
        const self = ctx.getUnit()
        const targets = ctx.api.opponent.findUnitByPriority(
          ctx.utils.getFlat(params.targetPriority),
          { includeVariants: false, amount: 2 },
        )

        if (targets.length > 0) ctx.api.opponent.destroyUnits(targets)
        ctx.api.own.destroyUnits(self)
      },
    },
  ],
  uiConfig: ctx => [
    {
      key: 'uses',
      label: 'Uses',
      type: 'number',
      min: 0,
      max: UNIT_LIMITS.DREADNOUGHT,
    },
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
  ],
}
