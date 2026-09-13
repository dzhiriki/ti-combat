import { z } from 'zod/mini'

import { type Ability, declareParam } from '@/combat'
import type { UnitList, UnitType } from '@/types'
import { UnitListNumberSchema } from '@/types'

type Params = {
  damagedUnits: UnitList<number>
}

export const preDamaged: Ability<Params> = {
  key: 'PRE_DAMAGED',
  name: 'Damaged Units',
  paramsSchema: z.object({
    damagedUnits: UnitListNumberSchema,
  }),
  params: {
    isEnabled: true,
    uses: Infinity,
    damagedUnits: declareParam<UnitList<number>>({
      source: 'units',
      default: [],
      filter: { exclude: ['FIGHTER'], includeOnlyAvailable: true },
      limit: 'IN_COMBAT',
    }),
  },
  uiConfig: ctx => [
    {
      key: 'damagedUnits',
      type: 'unit-list',
      mode: 'number',
      items: ctx.api.own.getUnitVariantsOptions('damagedUnits'),
    },
  ],
  invoke: [
    {
      timing: 'PREPARE',
      call: (ctx, params) => {
        for (const [unitType, count] of params.damagedUnits) {
          if (count <= 0) continue
          const ids = ctx.api.own.getUnits(unitType as UnitType, {
            includeVariants: false,
          })
          const max = Math.min(count, ids.length)
          for (let i = 0; i < max; i++) {
            ctx.api.own.modifyUnitState(ids[i], { isDamaged: true })
          }
        }
      },
    },
  ],
}
