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
          deferCompletionCheck: true,
        })
      },
    },
  ],
}

/** "Galvanized units present" on the bombarded planet: participating units
 *  (ground forces in ground combat) plus structures sitting in the
 *  non-participating pool (PDS / SPACE_DOCK per SETTINGS.structures).
 *  Excludes ships parked in space during ground combat — they're not on
 *  the planet being bombarded. */
function countGalvanizedUnits(ctx: AbilityReadContext): number {
  const sideState = ctx.state[ctx.side]
  const structures = new Set<string>(
    ctx.api.own.getAbilityConfig('SETTINGS').structures,
  )
  let count = 0
  for (const id of sideState.participatingUnits) {
    const key = sideState.unitType[id]
    if (!key) continue
    if (parseVariantId(key).subtypes.includes(GALVANIZED)) count++
  }
  for (const id of sideState.nonParticipatingUnits) {
    const key = sideState.unitType[id]
    if (!key) continue
    const { type, subtypes } = parseVariantId(key)
    if (!structures.has(type)) continue
    if (subtypes.includes(GALVANIZED)) count++
  }
  return count
}
