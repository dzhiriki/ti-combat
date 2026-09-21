import { z } from 'zod/mini'

import { type Ability, type AbilityReadContext, parseVariantId } from '@/combat'
import { GALVANIZED } from '@/data/main/abilities/general/pre-galvanized'

type Params = {
  resolveBombardment: boolean
  bombardmentMinGalvanized: number
}

declare global {
  interface AbilityConfigMap {
    PROXIMA_TARGETING_VI: Params
  }
}

export const proximaTargetingVi: Ability<Params> = {
  key: 'PROXIMA_TARGETING_VI',
  name: 'Proxima Targeting VI',
  description:
    "Cancel 1 hit produced by Bombardment rolls made against your ground forces for each of your galvanized units present. At the start of a round of ground combat you may resolve Bombardment 8 (x3) against your opponent's ground forces; if you do, make an identical roll against your own ground forces.",
  warning:
    'Additional dice (i.e. Plasma Scoring) are used only for rolls against the opponent. Rerolls against yourself using the opposite logic (i.e. Agnlan Oln reroll hits, not misses). Opponents Scramble Frequency can be used on any roll using inverse strategy.',
  context: 'GROUND',
  paramsSchema: z.object({
    resolveBombardment: z.boolean(),
    bombardmentMinGalvanized: z.number(),
  }),
  params: {
    isEnabled: false,
    uses: Infinity,
    resolveBombardment: false,
    bombardmentMinGalvanized: 0,
  },
  headerUI: 'isEnabled',
  uiConfig: (_ctx, { resolveBombardment }) => {
    return [
      {
        key: 'resolveBombardment',
        label: 'Resolve Bombardment',
        type: 'checkbox',
      },
      {
        key: 'bombardmentMinGalvanized',
        label: 'Only if galvanized count ≥',
        type: 'number',
        min: 0,
        visible: resolveBombardment,
      },
    ]
  },
  invoke: [
    {
      timing: 'BEFORE_ASSIGN_HITS',
      context: 'BOMBARDMENT',
      isCallable: (_params, ctx) => {
        if (ctx.api.own.getPendingHits() === 0) return false
        return countGalvanizedUnits(ctx) > 0
      },
      call: ctx => {
        ctx.api.own.reduceHits(countGalvanizedUnits(ctx))
      },
    },
    {
      timing: 'START_OF_COMBAT_ROUND',
      context: 'GROUND_COMBAT',
      isCallable: (params, ctx) => {
        if (!params.resolveBombardment) return false
        return countGalvanizedUnits(ctx) >= params.bombardmentMinGalvanized
      },
      call: ctx => {
        ctx.resolveStep('BOMBARDMENT', { dice: [[8, 3]], target: 'OWN' })
        ctx.resolveStep('BOMBARDMENT', {
          dice: [[8, 3]],
          deferPhaseEndCheck: true,
        })
      },
    },
  ],
}

/** "Galvanized units present" on the active planet. */
function countGalvanizedUnits(ctx: AbilityReadContext): number {
  return ctx.api.own.surface
    .getUnits(undefined, { includeVariants: true })
    .filter(id => {
      const key = ctx.api.own.getUnitVariantKey(id)
      return key && parseVariantId(key).subtypes.includes(GALVANIZED)
    }).length
}
