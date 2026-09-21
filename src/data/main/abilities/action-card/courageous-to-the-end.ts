import { z } from 'zod/mini'

import { type Ability, declareParam } from '@/combat'
import type { UnitList } from '@/types'
import { UnitListBooleanSchema } from '@/types'

type Params = {
  ownPriority: UnitList<boolean>
  targetPriority: UnitList<boolean>
}

export const courageousToTheEnd: Ability<Params> = {
  key: 'COURAGEOUS_TO_THE_END',
  name: 'Courageous to the End',
  description:
    "After 1 of your ships is destroyed during a space combat: Roll 2 dice. For each result equal to or greater than that ship's combat value, your opponent must choose and destroy 1 of their ships.",
  context: 'SPACE',
  paramsSchema: z.object({
    ownPriority: UnitListBooleanSchema,
    targetPriority: UnitListBooleanSchema,
  }),
  params: {
    isEnabled: false,
    uses: 1,
    ownPriority: declareParam<UnitList<boolean>>({
      default: [],
      source: 'ships',
      side: 'own',
      defaultItemValue: true,
      filter: { combatMode: 'SPACE' },
    }),
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
      isCallable: (params, ctx, ids) => {
        const ownDestroyedVariants = new Set<string>()
        for (const id of ids) {
          const key = ctx.api.own.getUnitVariantKey(id)
          if (key) ownDestroyedVariants.add(key)
        }
        const ownEnabled = ctx.utils.getFlat(params.ownPriority)
        if (!ownEnabled.some(v => ownDestroyedVariants.has(v))) return false

        const targets = ctx.api.opponent.getAssignHitsTargets(2)
        const targetEnabled = new Set<string>(
          ctx.utils.getFlat(params.targetPriority),
        )
        return targets.every(targetId =>
          targetEnabled.has(ctx.api.opponent.getUnitVariantKey(targetId)!),
        )
      },
      call: (ctx, params, ids) => {
        // Anchor the dice roll on the best (lowest combat value → easiest to
        // hit) destroyed own ship among those matching ownPriority.
        const ownDestroyedVariants = new Set<string>()
        for (const id of ids) {
          const key = ctx.api.own.getUnitVariantKey(id)
          if (key) ownDestroyedVariants.add(key)
        }
        let combatValue: number | undefined
        for (const variantKey of ctx.utils.getFlat(params.ownPriority)) {
          if (!ownDestroyedVariants.has(variantKey)) continue
          const stats = ctx.api.own.getUnitStats(variantKey)
          if (!stats?.COMBAT) continue
          const v = stats.COMBAT[0]
          if (combatValue === undefined || v < combatValue) combatValue = v
        }

        if (combatValue === undefined) return

        ctx.rollDice([[combatValue, 2]], (branchCtx, hits) => {
          const total = hits[0]
          if (total === 0) return
          const targets = branchCtx.api.opponent.getAssignHitsTargets(total)
          branchCtx.api.opponent.destroyUnits(targets)
        })
      },
    },
  ],
  uiConfig: ctx => [
    {
      key: 'ownPriority',
      label: 'Own Trigger Priority',
      type: 'unit-list',
      mode: 'checkbox',
      items: ctx.api.own.getUnitVariantsOptions('ownPriority'),
    },
    {
      key: 'targetPriority',
      // A spend gate, not targeting: the opponent assigns the kills via
      // their own sacrifice order — this only governs whether the card is
      // worth playing.
      label: "Use only if they'd lose",
      type: 'unit-list',
      mode: 'checkbox',
      items: ctx.api.opponent.getUnitVariantsOptions('targetPriority'),
    },
  ],
}
