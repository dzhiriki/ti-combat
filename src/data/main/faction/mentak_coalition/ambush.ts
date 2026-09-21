import { z } from 'zod/mini'

import { type Ability, declareParam } from '@/combat'
import type { DiceGroup, UnitBaseType, UnitId, UnitList } from '@/types'
import { UnitListBooleanSchema } from '@/types'

type Params = {
  attackerPriority: UnitList<boolean>
}

export const ambush: Ability<Params> = {
  key: 'AMBUSH',
  name: 'Ambush',
  description:
    "At the start of a space combat, you may roll 1 die for each of up to 2 of your cruisers or destroyers in the system. For each result equal to or greater than that ship's combat value produce 1 hit; your opponent must assign it to 1 of their ships.",
  context: 'SPACE',
  paramsSchema: z.object({
    attackerPriority: UnitListBooleanSchema,
  }),
  params: {
    isEnabled: false,
    uses: 1,
    attackerPriority: declareParam({
      default: [] as UnitList<boolean>,
      source: 'ships',
      side: 'own',
      sort: 'worth-desc',
      defaultItemValue: true,
      filter: {
        include: ['CRUISER', 'DESTROYER'] as UnitBaseType[],
        combatMode: 'SPACE',
      },
    }),
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'START_OF_COMBAT',
      isCallable: (_params, ctx) => {
        const ATTACKER_TYPES = ['CRUISER', 'DESTROYER'] as UnitBaseType[]
        return (
          ctx.api.own.countUnits(ATTACKER_TYPES, {
            includeVariants: true,
          }) > 0
        )
      },
      call: (ctx, params) => {
        const MAX_SHIPS = 2
        // Pick up to MAX_SHIPS cruisers/destroyers following the configured
        // priority. Fall back to any remaining cruisers/destroyers if the
        // priority list is empty or short.
        const selected: UnitId[] = []

        for (const variantKey of ctx.utils.getFlat(params.attackerPriority)) {
          for (const uid of ctx.api.own.getUnits(variantKey, {
            includeVariants: false,
          })) {
            if (selected.length >= MAX_SHIPS) break
            selected.push(uid)
          }
        }

        const dice: DiceGroup[] = selected.map(unitId => {
          const stats = ctx.api.own.getUnitStats(unitId)!
          return [stats.COMBAT![0], 1]
        })

        ctx.rollDice(dice, (branchCtx, hits) => {
          const total = hits.reduce((a, b) => a + b, 0)
          branchCtx.api.opponent.addHits(total)
        })
      },
    },
  ],
  uiConfig: ctx => [
    {
      key: 'attackerPriority',
      label: 'Ship Priority',
      type: 'unit-list',
      mode: 'checkbox',
      sortable: true,
      items: ctx.api.own.getUnitVariantsOptions('attackerPriority'),
    },
  ],
}
