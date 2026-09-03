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
        const { ships: ownShips } = ctx.api.own.getAbilityConfig('SETTINGS')
        const { ships: opponentShips } =
          ctx.api.opponent.getAbilityConfig('SETTINGS')
        const ownDestroyedShips = collectOwnDestroyedShipTypes(
          ctx,
          ids,
          ownShips,
        )
        const opponentShipsSet = new Set<UnitBaseType>(opponentShips)
        for (const variantId of ctx.utils.getFlat(params.targetPriority)) {
          const { type } = parseVariantId(variantId)
          if (
            ownDestroyedShips.has(type) &&
            opponentShipsSet.has(type) &&
            ctx.api.opponent.hasUnitType(type, { includeVariants: false })
          )
            return true
        }
        return false
      },
      call: (ctx, params, ids) => {
        const { ships: ownShips } = ctx.api.own.getAbilityConfig('SETTINGS')
        const { ships: opponentShips } =
          ctx.api.opponent.getAbilityConfig('SETTINGS')
        const ownDestroyedShips = collectOwnDestroyedShipTypes(
          ctx,
          ids,
          ownShips,
        )
        const opponentShipsSet = new Set<UnitBaseType>(opponentShips)
        for (const variantId of ctx.utils.getFlat(params.targetPriority)) {
          const { type } = parseVariantId(variantId)
          if (
            ownDestroyedShips.has(type) &&
            opponentShipsSet.has(type) &&
            ctx.api.opponent.hasUnitType(type, { includeVariants: false })
          ) {
            ctx.api.opponent.destroyUnits(type)
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
  ships: UnitBaseType[],
): Set<UnitBaseType> {
  const shipsSet = new Set<UnitBaseType>(ships)
  const types = new Set<UnitBaseType>()
  for (const id of destroyedIds) {
    const variantKey = ctx.api.own.getUnitVariantKey(id)
    if (!variantKey) continue
    const { type } = parseVariantId(variantKey)
    if (shipsSet.has(type)) types.add(type)
  }
  return types
}
