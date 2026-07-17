import { z } from 'zod/mini'

import type { Ability } from '@/combat'
import type { UnitType } from '@/types'

type Params = {
  unitType: UnitType | ''
}

declare global {
  interface AbilityConfigMap {
    TF_SUPERCHARGE: Params
  }
}

// Twilight's Fall Abilities-deck card (from Naaz-Rokha's kit). Distinct from
// the TI4 SUPERCHARGE technology (+1 to ALL of a side's rolls for one round,
// exhaust-based): the TF card is permanent and boosts exactly ONE chosen
// unit's combat rolls by +2 every round.
export const supercharge: Ability<Params> = {
  key: 'TF_SUPERCHARGE',
  name: 'Supercharge',
  description:
    'Before making a combat roll: Choose 1 of your units and apply +2 to the results of its combat roll.',
  paramsSchema: z.object({ unitType: z.string() }),
  params: {
    isEnabled: false,
    uses: Infinity,
    unitType: '',
  },
  headerUI: 'isEnabled',
  uiConfig: ctx => [
    {
      key: 'unitType',
      label: 'Unit',
      type: 'select',
      items: [
        { label: 'None', value: '' },
        ...ctx.api.own.getUnitVariantsOptions(),
      ],
    },
  ],
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      isCallable: (params, ctx) =>
        params.unitType !== '' &&
        ctx.api.own.hasUnitType(params.unitType, { includeVariants: false }),
      call: (ctx, params) => {
        ctx.api.own.applyBonusToResult(2, {
          singleUnit: params.unitType as UnitType,
        })
      },
    },
  ],
}
