import { z } from 'zod/mini'

import { type Ability, type AbilityReadContext, declareParam } from '@/combat'
import type { UnitId, UnitList, UnitType } from '@/types'
import { UnitListSchema } from '@/types'

type Params = {
  spaceRepairPriority: UnitList
  groundRepairPriority: UnitList
}

export const duraniumArmor: Ability<Params> = {
  key: 'DURANIUM_ARMOR',
  name: 'Duranium Armor',
  description:
    'During each combat round, after you assign hits to your units, repair 1 of your damaged units that did not use Sustain Damage during this combat round.',
  paramsSchema: z.object({
    spaceRepairPriority: UnitListSchema,
    groundRepairPriority: UnitListSchema,
  }),
  params: {
    isEnabled: false,
    uses: Infinity,
    spaceRepairPriority: declareParam<UnitList>({
      default: [],
      source: 'nonFighterShips',
      sort: 'worth-desc',
      filter: { combatMode: 'SPACE' },
    }),
    groundRepairPriority: declareParam<UnitList>({
      default: [],
      source: 'groundForces',
      sort: 'worth-desc',
      filter: { combatMode: 'GROUND' },
    }),
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'WHEN_SUSTAIN_DAMAGE_USE',
      context: ['SPACE_COMBAT', 'GROUND_COMBAT'],
      system: true,
      isCallable: (_params, ctx, unit) => ctx.api.own.hasUnit(unit),
      call: (ctx, _params, unit) => {
        ctx.api.own.modifyUnitState(unit, { usedSustainThisRound: true })
        ctx.api.own.resortUnits(unit)
      },
    },
    {
      timing: 'AFTER_ASSIGN_HITS_STEP',
      context: ['SPACE_COMBAT', 'GROUND_COMBAT'],
      isCallable: (params, ctx) => findRepairTarget(params, ctx) !== undefined,
      call: (ctx, params) => {
        const target = findRepairTarget(params, ctx)!
        ctx.api.own.modifyUnitState(target, { isDamaged: false })
        ctx.api.own.resortUnits(target)
      },
    },
    {
      timing: 'CLEANUP_ROUND',
      system: true,
      call: ctx => {
        for (const key in ctx.state[ctx.side].unitState) {
          const unitId = key as UnitId
          const state = ctx.state[ctx.side].unitState[unitId]
          if (state.usedSustainThisRound) {
            ctx.api.own.modifyUnitState(unitId, {
              usedSustainThisRound: false,
            })
          }
        }
      },
    },
  ],
  uiConfig: ctx => {
    const isGround = ctx.state.combatMode === 'GROUND'
    const key = isGround ? 'groundRepairPriority' : 'spaceRepairPriority'

    return [
      {
        key,
        type: 'unit-list',
        mode: 'order',
        items: ctx.api.own.getUnitVariantsOptions(key),
      },
    ]
  },
}

function findRepairTarget(
  params: Params,
  ctx: AbilityReadContext,
): UnitId | undefined {
  const isGround = ctx.state.combatMode === 'GROUND'
  const priority = isGround
    ? params.groundRepairPriority
    : params.spaceRepairPriority

  for (const [variantId] of priority) {
    for (const unitId of ctx.api.own.getUnits(variantId as UnitType, {
      includeVariants: false,
    })) {
      const state = ctx.api.own.getUnitState(unitId)
      if (!state?.isDamaged) continue
      if (state.usedSustainThisRound) continue
      return unitId
    }
  }

  return undefined
}
