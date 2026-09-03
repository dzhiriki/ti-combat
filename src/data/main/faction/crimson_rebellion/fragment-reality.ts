import { z } from 'zod/mini'

import crimsonRebellionIcon from '@/assets/faction/crimson_rebellion.svg?raw'
import { type Ability, declareParam } from '@/combat'
import type { UnitBaseType, UnitList } from '@/types'
import { UnitListNumberSchema } from '@/types'

type Params = {
  isEnabled: boolean
  uses: number
  ships: UnitList<number, UnitBaseType>
}

export const fragmentReality: Ability<Params> = {
  key: 'FRAGMENT_REALITY',
  name: 'Fragment Reality',
  description:
    'At the start of a space combat, you may purge this card to place all ships from this card into the active system.',
  icon: crimsonRebellionIcon,
  context: 'SPACE',
  paramsSchema: z.object({
    ships: UnitListNumberSchema,
  }),
  params: {
    isEnabled: false,
    uses: Infinity,
    ships: declareParam({
      default: [],
      source: 'ships',
      defaultItemValue: 0,
      filter: { combatMode: 'SPACE', includeOnlyBaseTypes: true },
      limit: 'EXTRA',
    }),
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'START_OF_COMBAT',
      isCallable: (params, ctx) => ctx.utils.getFlat(params.ships).length > 0,
      call: (ctx, params) => {
        const toPlace: Partial<Record<UnitBaseType, number>> = {}
        for (const [type, count] of params.ships) {
          if (count > 0) toPlace[type as UnitBaseType] = count
        }
        ctx.api.own.placeUnits(toPlace)
      },
    },
  ],
  uiConfig: ctx => [
    {
      key: 'ships',
      type: 'unit-list',
      mode: 'number',
      items: ctx.api.own.getUnitVariantsOptions('ships'),
    },
  ],
}
