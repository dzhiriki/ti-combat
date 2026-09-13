import { z } from 'zod/mini'

import { type Ability, declareParam } from '@/combat'
import { UnitListSchema } from '@/types'
import { type UnitList } from '@/types'

type Params = {
  targetPriority: UnitList
}

export const assaultCannon: Ability<Params> = {
  key: 'ASSAULT_CANNON',
  name: 'Assault Cannon',
  description:
    'At the start of a space combat in a system that contains 3 or more of your non-fighter ships, your opponent must destroy 1 of their non-fighter ships.',
  context: 'SPACE',
  paramsSchema: z.object({
    targetPriority: UnitListSchema,
  }),
  params: {
    isEnabled: false,
    uses: Infinity,
    targetPriority: declareParam<UnitList>({
      default: [],
      source: 'nonFighterShips',
      side: 'opponent',
      filter: { combatMode: 'SPACE' },
    }),
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'START_OF_COMBAT',
      isCallable: (_, ctx) => {
        const { nonFighterShips } = ctx.api.own.getAbilityConfig('SETTINGS')
        const nonFighterCount = ctx.api.own.countUnits(nonFighterShips, {
          includeVariants: true,
        })
        if (nonFighterCount < 3) return false

        return true
      },
      call: (ctx, params) => {
        const target = ctx.api.opponent.findUnitByPriority(
          ctx.utils.getFlat(params.targetPriority),
          { includeVariants: false },
        )!

        ctx.api.opponent.destroyUnits(target)
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
