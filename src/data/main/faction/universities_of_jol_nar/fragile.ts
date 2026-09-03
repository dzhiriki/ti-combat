import { z } from 'zod/mini'

import type { Ability } from '@/combat/abilities-engine/types'
import type { UnitBaseType } from '@/types'

type Params = {
  isEnabled: boolean
  uses: number
  excludeUnits: UnitBaseType[]
}

export const fragile: Ability<Params> = {
  key: 'FRAGILE',
  name: 'Fragile',
  description: "Apply -1 to the result of each of your unit's combat rolls.",
  paramsSchema: z.object({
    excludeUnits: z.array(z.string()),
  }),
  params: {
    isEnabled: true,
    uses: Infinity,
    excludeUnits: [],
  },
  headerUI: 'isEnabled',
  readOnly: true,
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      call: (ctx, params) => {
        if (params.excludeUnits.length === 0) {
          ctx.api.own.applyBonusToResult(-1)
        } else {
          ctx.api.own.applyBonusToResult(-1, { exclude: params.excludeUnits })
        }
      },
    },
  ],
}
