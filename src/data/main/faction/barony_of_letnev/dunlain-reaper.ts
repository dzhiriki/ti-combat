import { z } from 'zod/mini'

import { type Ability, declareParam, parseVariantId } from '@/combat'
import { UNIT_LIMITS } from '@/constants/units'
import type { UnitList } from '@/types'
import { UnitListBooleanSchema } from '@/types'

type Params = {
  targetPriority: UnitList<boolean>
  availableMechs: number
}

declare global {
  interface AbilityConfigMap {
    DUNLAIN_REAPER: Params
  }
}

export const dunlainReaper: Ability<Params> = {
  key: 'DUNLAIN_REAPER',
  name: 'Dunlain Reaper',
  description:
    'At the start of a round of ground combat, you may spend 2 resources to replace 1 of your infantry in that combat with 1 mech.',
  context: 'GROUND',
  paramsSchema: z.object({
    targetPriority: UnitListBooleanSchema,
    availableMechs: z.number().check(z.gte(0), z.lte(UNIT_LIMITS.MECH)),
  }),
  params: {
    isEnabled: true,
    uses: 0,
    availableMechs: UNIT_LIMITS.MECH,
    targetPriority: declareParam<UnitList<boolean>>({
      default: [],
      source: 'groundForces',
      side: 'own',
      defaultItemValue: true,
      sort: 'worth-asc',
      filter: { include: ['INFANTRY'], combatMode: 'GROUND' },
    }),
  },
  headerUI: 'uses',
  invoke: [
    {
      timing: 'START_OF_COMBAT_ROUND',
      isCallable: (params, ctx) => {
        if (params.availableMechs <= 0) return false
        return (
          ctx.api.own.findUnitByPriority(
            ctx.utils.getFlat(params.targetPriority),
            { includeVariants: false },
          ) !== undefined
        )
      },
      call: (ctx, params) => {
        const target = ctx.api.own.findUnitByPriority(
          ctx.utils.getFlat(params.targetPriority),
          { includeVariants: false },
        )!
        ctx.api.own.removeUnits(target)
        ctx.api.own.placeUnits({ MECH: 1 })
        ctx.api.own.updateAbilityConfig({
          availableMechs: params.availableMechs - 1,
        })
      },
    },
    {
      timing: 'DESTROY',
      system: true,
      isCallable: (params, ctx, ids) => {
        if (params.availableMechs >= UNIT_LIMITS.MECH) return false
        return ids.some(id => {
          const variantKey = ctx.api.own.getUnitVariantKey(id)
          return (
            variantKey !== undefined &&
            parseVariantId(variantKey).type === 'MECH'
          )
        })
      },
      call: (ctx, params, ids) => {
        let destroyed = 0
        for (const id of ids) {
          const variantKey = ctx.api.own.getUnitVariantKey(id)
          if (variantKey && parseVariantId(variantKey).type === 'MECH') {
            destroyed += 1
          }
        }
        ctx.api.own.updateAbilityConfig({
          availableMechs: Math.min(
            UNIT_LIMITS.MECH,
            params.availableMechs + destroyed,
          ),
        })
      },
    },
  ],
  uiConfig: ctx => {
    const items = ctx.api.own.getUnitVariantsOptions('targetPriority')

    return [
      {
        key: 'availableMechs',
        label: 'Available Mechs',
        type: 'number',
        min: 0,
        max: UNIT_LIMITS.MECH,
      },
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
