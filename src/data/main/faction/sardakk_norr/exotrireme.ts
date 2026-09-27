import { z } from 'zod/mini'

import { type Ability, declareParam } from '@/combat'
import { parseUnitLocator } from '@/combat/utils/parse-unit-locator'
import { UNIT_LIMITS } from '@/constants/units'
import type { UnitId, UnitList } from '@/types'
import { UnitListBooleanSchema } from '@/types'

type Params = {
  sacrificePriority: UnitList<boolean>
  targetPriority: UnitList<boolean>
}

export const exotrireme: Ability<Params> = {
  key: 'EXOTRIREME',
  name: 'Exotrireme II',
  description:
    'This unit cannot be destroyed by Direct Hit action cards. After a round of space combat, you may destroy this unit to destroy up to 2 ships in this system.',
  context: 'SPACE',
  paramsSchema: z.object({
    sacrificePriority: UnitListBooleanSchema,
    targetPriority: UnitListBooleanSchema,
  }),
  // On by default: its uses (0 = none) are the sacrifices to make.
  params: {
    isEnabled: true,
    uses: 0,
    // Every unit carrying this ability may be sacrificed: the dreadnoughts
    // and anything that copies their text (The Faces of Janovet).
    sacrificePriority: declareParam({
      default: [] as UnitList<boolean>,
      source: 'SHIPS',
      side: 'own',
      defaultItemValue: true,
      filter: { withAbility: true, combatMode: 'SPACE' },
    }),
    targetPriority: declareParam<UnitList<boolean>>({
      default: [],
      source: 'SHIPS',
      side: 'opponent',
      sort: 'worth-desc',
      defaultItemValue: true,
      filter: { combatMode: 'SPACE' },
    }),
  },
  headerUI: 'uses',
  sort: (params, ctx, unitIds) => {
    const remaining = new Set(unitIds)
    const result: UnitId[] = []
    for (const variantId of ctx.utils.getFlat(params.sacrificePriority)) {
      for (const id of ctx.api.own.participating.getUnits(variantId)) {
        if (remaining.has(id)) {
          result.push(id)
          remaining.delete(id)
        }
      }
    }
    for (const id of unitIds) {
      if (remaining.has(id)) result.push(id)
    }
    return result
  },
  invoke: [
    {
      timing: 'AFTER_COMBAT_ROUND',
      isCallable: (params, ctx) => {
        if (
          ctx.api.opponent.participating.findUnitByPriority(
            ctx.utils.getFlat(params.targetPriority),
          ) === undefined
        ) {
          return false
        }
        return ctx.api.own.matchesUnitList(
          ctx.getUnit(),
          params.sacrificePriority,
        )
      },
      call: (ctx, params) => {
        const self = ctx.getUnit()
        const targets = ctx.api.opponent.participating.findUnitByPriority(
          ctx.utils.getFlat(params.targetPriority),
          { amount: 2 },
        )

        if (targets.length > 0) ctx.api.opponent.destroyUnits(targets)
        ctx.api.own.destroyUnits(self)
      },
    },
  ],
  uiConfig: ctx => {
    const sacrifices = ctx.api.own.getUnitVariantsOptions('sacrificePriority')
    // One use per sacrifice: up to every unit that carries this ability.
    const carriers = new Set(
      sacrifices.map(item => parseUnitLocator(item.value).baseType),
    )
    const maxUses = [...carriers].reduce(
      (sum, type) => sum + UNIT_LIMITS[type],
      0,
    )

    return [
      {
        key: 'uses',
        label: 'Uses',
        type: 'number',
        min: 0,
        max: maxUses,
        // In the header here; copies switched on by their own header (the TF
        // card, Nekro's copy) set their uses in this control.
        visible: ctx.this.headerUI !== 'uses',
      },
      {
        key: 'sacrificePriority',
        label: 'Sacrifice Priority',
        type: 'unit-list',
        mode: 'checkbox',
        sortable: true,
        items: sacrifices,
        visible: sacrifices.length > 1,
      },
      {
        key: 'targetPriority',
        label: 'Target Priority',
        type: 'unit-list',
        mode: 'checkbox',
        sortable: true,
        items: ctx.api.opponent.getUnitVariantsOptions('targetPriority'),
      },
    ]
  },
}
