import { z } from 'zod/mini'

import obsidianIcon from '@/assets/faction/obsidian.svg?raw'
import {
  type Ability,
  type AbilityReadContext,
  declareParam,
  parseVariantId,
} from '@/combat'
import type { UnitBaseType, UnitId, UnitList } from '@/types'
import { UnitListBooleanSchema } from '@/types'

type Params = {
  targetPriority: UnitList<boolean>
}

export const vosHollow: Ability<Params> = {
  key: 'VOS_HOLLOW',
  name: 'Vos Hollow',
  description:
    "When a player's ship is destroyed during any combat: You may exhaust this card; if you do, that player's opponent must destroy 1 of their ships of the same type in the active system.",
  icon: obsidianIcon,
  context: 'SPACE',
  paramsSchema: z.object({
    targetPriority: UnitListBooleanSchema,
  }),
  params: {
    isEnabled: false,
    uses: 1,
    targetPriority: declareParam<UnitList<boolean>>({
      default: [],
      source: 'ships',
      side: 'opponent',
      defaultItemValue: true,
      filter: { combatMode: 'SPACE' },
    }),
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'AFTER_DESTROY',
      external: true,
      isCallable: (params, ctx, ids) => {
        const ownDestroyedShips = collectOwnDestroyedShipTypes(ctx, ids)
        for (const variantId of ctx.utils.getFlat(params.targetPriority)) {
          const { type } = parseVariantId(variantId)
          if (
            ownDestroyedShips.has(type) &&
            ctx.api.opponent.participating.hasUnitType(type, {
              includeVariants: false,
            })
          )
            return true
        }
        return false
      },
      call: (ctx, params, ids) => {
        const ownDestroyedShips = collectOwnDestroyedShipTypes(ctx, ids)
        for (const variantId of ctx.utils.getFlat(params.targetPriority)) {
          const { type } = parseVariantId(variantId)
          if (
            ownDestroyedShips.has(type) &&
            ctx.api.opponent.participating.hasUnitType(type, {
              includeVariants: false,
            })
          ) {
            const [target] = ctx.api.opponent.participating.getUnits(type, {
              includeVariants: false,
            })
            if (target) ctx.api.opponent.destroyUnits(target)
            return
          }
        }
      },
    },
  ],
  uiConfig: ctx => [
    {
      key: 'targetPriority',
      type: 'unit-list',
      mode: 'checkbox',
      sortable: true,
      items: ctx.api.opponent.getUnitVariantsOptions('targetPriority'),
    },
  ],
}

function collectOwnDestroyedShipTypes(
  ctx: AbilityReadContext,
  destroyedIds: UnitId[],
): Set<UnitBaseType> {
  const types = new Set<UnitBaseType>()
  for (const id of destroyedIds) {
    const variantKey = ctx.api.own.getUnitVariantKey(id)
    if (!variantKey) continue
    const { type } = parseVariantId(variantKey)
    if (ctx.api.own.isUnitCategory(id, 'SHIPS')) types.add(type)
  }
  return types
}
