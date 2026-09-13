import { z } from 'zod/mini'

import type { Ability } from '@/combat/abilities-engine/types'

type Params = {
  supportCount: number
}

export const imperator: Ability<Params> = {
  key: 'IMPERATOR',
  name: 'Imperator',
  description:
    'Apply +1 to the results of each of your unit\'s combat rolls for each "Support for the Throne" in your opponent\'s play area.',
  paramsSchema: z.object({ supportCount: z.number() }),
  params: {
    isEnabled: true,
    uses: Infinity,
    supportCount: 0,
  },
  headerUI: 'supportCount',
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      call: (ctx, params) => {
        ctx.api.own.applyBonusToResult(params.supportCount)
      },
    },
  ],
}
