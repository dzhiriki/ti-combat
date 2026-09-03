import { z } from 'zod/mini'

import type { Ability } from '@/combat'

type Params = {
  resolveBombardment: boolean
}

declare global {
  interface AbilityConfigMap {
    TF_PROXIMA_TARGETING_VI: Params
  }
}

// Twilight's Fall Abilities-deck card. Distinct from the Last Bastion (TE)
// PROXIMA_TARGETING_VI, which scales with galvanized units — TF has no
// Galvanize: the hit-cancel is a flat 1 per Bombardment roll, and the
// optional bombardment is 7(x3) instead of 8(x3). Structure mirrors the TE
// implementation: the self-roll resolves first, merged into the same round
// step as the roll against the opponent.
export const proximaTargetingVi: Ability<Params> = {
  key: 'TF_PROXIMA_TARGETING_VI',
  name: 'Proxima Targeting VI',
  description:
    "Cancel 1 hit produced by each Bombardment roll against your units. At the start of a round of ground combat, you may resolve Bombardment 7 (x3) against your opponent's ground forces; if you do, resolve Bombardment 7 (x3) against your own ground forces.",
  context: 'GROUND',
  paramsSchema: z.object({
    resolveBombardment: z.boolean(),
  }),
  params: {
    isEnabled: false,
    uses: Infinity,
    resolveBombardment: false,
  },
  headerUI: 'isEnabled',
  uiConfig: [
    {
      key: 'resolveBombardment',
      label: 'Resolve Bombardment',
      type: 'checkbox',
    },
  ],
  invoke: [
    {
      timing: 'BEFORE_ASSIGN_HITS',
      context: 'BOMBARDMENT',
      isCallable: (_params, ctx) => ctx.api.own.getPendingHits() > 0,
      call: ctx => {
        ctx.api.own.reduceHits(1)
      },
    },
    {
      timing: 'START_OF_COMBAT_ROUND',
      context: 'GROUND_COMBAT',
      isCallable: params => params.resolveBombardment,
      call: ctx => {
        ctx.resolveStep('BOMBARDMENT', { dice: [[7, 3]], target: 'OWN' })
        ctx.resolveStep('BOMBARDMENT', {
          dice: [[7, 3]],
          deferCompletionCheck: true,
        })
      },
    },
  ],
}
