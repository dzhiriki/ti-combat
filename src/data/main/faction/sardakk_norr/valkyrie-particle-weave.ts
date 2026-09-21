import type { Ability } from '@/combat'

export const valkyrieParticleWeave: Ability = {
  key: 'VALKYRIE_PARTICLE_WEAVE',
  name: 'Valkyrie Particle Weave',
  description:
    'After making combat rolls during a round of ground combat, if your opponent produced 1 or more hits, you produce 1 additional hit.',
  context: 'GROUND',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'AFTER_DICE_ROLL',
      context: 'GROUND_COMBAT',
      isCallable: (_params, ctx) => ctx.api.own.getPendingHits() >= 1,
      call: ctx => {
        ctx.api.opponent.addHits(1)
      },
    },
  ],
}
