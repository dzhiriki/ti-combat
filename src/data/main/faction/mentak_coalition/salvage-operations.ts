import { z } from 'zod/mini'

import { type Ability, declareParam, parseVariantId } from '@/combat'
import type { UnitBaseType, UnitList } from '@/types'
import { UnitListSchema } from '@/types'

type Params = {
  shipPriority: UnitList<never, UnitBaseType>
  _destroyedShipTypes: UnitBaseType[]
}

export const salvageOperations: Ability<Params> = {
  key: 'SALVAGE_OPERATIONS',
  name: 'Salvage Operations',
  description:
    'After you win or lose a space combat, gain 1 trade good; if you won the combat, you may also produce 1 ship in that system of any ship type that was destroyed during the combat.',
  context: 'SPACE',
  paramsSchema: z.object({
    shipPriority: UnitListSchema,
    _destroyedShipTypes: z.array(z.string()),
  }),
  params: {
    isEnabled: false,
    uses: 1,
    shipPriority: declareParam({
      default: [],
      source: 'SHIPS',
      filter: { combatMode: 'SPACE', includeOnlyBaseTypes: true },
    }),
    _destroyedShipTypes: [],
  },
  headerUI: 'isEnabled',
  uiConfig: ctx => [
    {
      key: 'shipPriority',
      label: 'Ship Priority',
      type: 'unit-list',
      mode: 'order',
      items: ctx.api.own.getUnitVariantsOptions('shipPriority'),
    },
  ],
  invoke: [
    {
      timing: 'DESTROY',
      system: true,
      call: (ctx, params, ids) => {
        const collected = new Set<UnitBaseType>(params._destroyedShipTypes)
        for (const id of ids) {
          const variantKey =
            ctx.api.own.getUnitVariantKey(id) ||
            ctx.api.opponent.getUnitVariantKey(id)
          if (!variantKey) continue
          const { type } = parseVariantId(variantKey)
          if (ctx.api.own.isUnitTypeCategory(type, 'SHIPS')) collected.add(type)
        }
        ctx.api.own.updateAbilityConfig({
          _destroyedShipTypes: [...collected],
        })
      },
    },
    {
      timing: 'END_OF_COMBAT',
      isCallable: (params, ctx) => {
        if (params._destroyedShipTypes.length === 0) return false
        if (
          ctx.api.own.participating.countUnits(undefined, {
            includeVariants: true,
          }) === 0
        )
          return false

        const destroyed = new Set<UnitBaseType>(params._destroyedShipTypes)
        return ctx.utils
          .getFlat(params.shipPriority)
          .some(t => destroyed.has(t as UnitBaseType))
      },
      call: (ctx, params) => {
        const destroyed = new Set<UnitBaseType>(params._destroyedShipTypes)
        for (const t of ctx.utils.getFlat(params.shipPriority)) {
          const baseType = t as UnitBaseType
          if (destroyed.has(baseType)) {
            ctx.api.own.placeUnits({ [baseType]: 1 })
            return
          }
        }
      },
    },
  ],
}
