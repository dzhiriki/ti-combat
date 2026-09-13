import { z } from 'zod/mini'

import type { Ability } from '@/combat/abilities-engine/types'

type Params = {
  nonHomeSystems: number
}

export const theEgeiro: Ability<Params> = {
  key: 'THE_EGEIRO',
  name: 'The Egeiro',
  description:
    "Apply +1 to the result of each of this unit's combat rolls for each non-home system that contains a planet you control.",
  context: 'SPACE',
  paramsSchema: z.object({ nonHomeSystems: z.number() }),
  params: {
    isEnabled: true,
    uses: Infinity,
    nonHomeSystems: 0,
  },
  headerUI: 'nonHomeSystems',
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      call: (ctx, params) => {
        ctx.api.own.applyBonusToResult(
          params.nonHomeSystems,
          ctx.api.own.getUnitBaseType(ctx.getUnit()),
        )
      },
    },
  ],
}
