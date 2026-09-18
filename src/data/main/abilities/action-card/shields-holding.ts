import type { Ability } from '@/combat'

export const shieldsHolding: Ability = {
  key: 'SHIELDS_HOLDING',
  name: 'Shields Holding',
  description:
    'Before you assign hits to your ships during a space combat: Cancel up to 2 hits.',
  context: 'SPACE',
  params: {
    isEnabled: true,
    uses: 0,
  },
  headerUI: 'uses',
  invoke: [
    {
      timing: 'BEFORE_ASSIGN_HITS',
      context: 'SPACE_COMBAT',
      isCallable: (_params, ctx) => {
        return ctx.api.own.getPendingHits() > 0
      },
      call: ctx => {
        ctx.api.own.reduceHits(2)
      },
    },
  ],
}
