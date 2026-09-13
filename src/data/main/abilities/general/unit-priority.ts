import { z } from 'zod/mini'

import { type Ability, declareParam } from '@/combat'
import type { UnitList } from '@/types'
import { UnitListSchema } from '@/types'

type Params = {
  spaceUnitPriority: UnitList
  groundUnitPriority: UnitList
}

declare global {
  interface AbilityConfigMap {
    UNIT_PRIORITY: Params
  }
}

export const unitPriority: Ability<Params> = {
  key: 'UNIT_PRIORITY',
  name: 'Assign Hits Order',
  paramsSchema: z.object({
    spaceUnitPriority: UnitListSchema,
    groundUnitPriority: UnitListSchema,
  }),
  params: {
    isEnabled: true,
    uses: Infinity,
    spaceUnitPriority: declareParam<UnitList>({
      default: [],
      source: 'spaceCombatParticipating',
    }),
    groundUnitPriority: declareParam<UnitList>({
      default: [],
      source: 'groundCombatParticipating',
    }),
  },
  invoke: [],
  uiConfig: ctx => {
    if (ctx.state.combatMode === 'GROUND') {
      return [
        {
          key: 'groundUnitPriority',
          type: 'unit-list',
          mode: 'order',
          items: ctx.api.own.getUnitVariantsOptions('groundUnitPriority'),
        },
      ]
    }

    return [
      {
        key: 'spaceUnitPriority',
        type: 'unit-list',
        mode: 'order',
        items: ctx.api.own.getUnitVariantsOptions('spaceUnitPriority'),
      },
    ]
  },
}
