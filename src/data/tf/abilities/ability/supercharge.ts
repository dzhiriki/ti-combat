import { z } from 'zod/mini'

import { type Ability, declareParam } from '@/combat'
import type { UnitList } from '@/types'
import { UnitListSchema } from '@/types'

type Params = {
  spacePriority: UnitList
  groundPriority: UnitList
}

declare global {
  interface AbilityConfigMap {
    TF_SUPERCHARGE: Params
  }
}

// Twilight's Fall Abilities-deck card (from Naaz-Rokha's kit). Distinct from
// the TI4 SUPERCHARGE technology (+1 to ALL of a side's rolls for one round,
// exhaust-based): the TF card is permanent and boosts exactly ONE unit's
// combat rolls by +2 every round. The unit is re-chosen each roll, so the
// target is a Gravleash-style priority list — when the preferred type has
// died, the bonus falls through to the next one instead of vanishing.
export const supercharge: Ability<Params> = {
  key: 'TF_SUPERCHARGE',
  name: 'Supercharge',
  description:
    'Before making a combat roll: Choose 1 of your units and apply +2 to the results of its combat roll.',
  paramsSchema: z.object({
    spacePriority: UnitListSchema,
    groundPriority: UnitListSchema,
  }),
  params: {
    isEnabled: false,
    uses: Infinity,
    spacePriority: declareParam<UnitList>({
      default: [],
      source: 'spaceCombatParticipating',
      sort: 'worth-desc',
      filter: { combatMode: 'SPACE' },
    }),
    groundPriority: declareParam<UnitList>({
      default: [],
      source: 'groundCombatParticipating',
      sort: 'worth-desc',
      filter: { combatMode: 'GROUND' },
    }),
  },
  headerUI: 'isEnabled',
  uiConfig: ctx => {
    const key =
      ctx.state.combatMode === 'GROUND' ? 'groundPriority' : 'spacePriority'
    return [
      {
        key,
        type: 'unit-list',
        mode: 'order',
        items: ctx.api.own.getUnitVariantsOptions(key),
      },
    ]
  },
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      call: (ctx, params) => {
        const priority =
          ctx.state.combatMode === 'GROUND'
            ? params.groundPriority
            : params.spacePriority
        const target = ctx.api.own.findUnitByPriority(
          ctx.utils.getFlat(priority),
          { includeVariants: false },
        )
        if (target === undefined) return
        const variantKey = ctx.api.own.getUnitVariantKey(target)
        if (!variantKey) return
        ctx.api.own.applyBonusToResult(2, { singleUnit: variantKey })
      },
    },
  ],
}
