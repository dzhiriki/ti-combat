import { z } from 'zod/mini'

import yinBrotherhoodIcon from '@/assets/faction/yin_brotherhood.svg?raw'
import { type Ability, declareParam } from '@/combat'
import type { UnitList } from '@/types'
import { UnitListBooleanSchema } from '@/types'

type Params = {
  targetPriority: UnitList<boolean>
}

export const greyfireMutagen: Ability<Params> = {
  key: 'GREYFIRE_MUTAGEN',
  name: 'Greyfire Mutagen',
  description:
    "At the start of a ground combat against 2 or more ground forces that are not controlled by the Yin player: Replace 1 of your opponent's infantry with 1 infantry from your reinforcements.",
  icon: yinBrotherhoodIcon,
  context: 'GROUND',
  paramsSchema: z.object({
    targetPriority: UnitListBooleanSchema,
  }),
  params: {
    isEnabled: false,
    uses: 1,
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
      isCallable: (params, ctx) => {
        if (ctx.api.opponent.getFaction() === 'YIN_BROTHERHOOD') return false
        const { groundForces } = ctx.api.opponent.getAbilityConfig('SETTINGS')
        if (
          ctx.api.opponent.countUnits(groundForces, { includeVariants: true }) <
          2
        )
          return false
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
        )
        if (target === undefined) return
        ctx.api.opponent.removeUnits(target)
        ctx.api.own.placeUnits({ INFANTRY: 1 })
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
