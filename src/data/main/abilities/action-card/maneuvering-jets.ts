import type { Ability } from '@/combat'

export const maneuveringJets: Ability = {
  key: 'MANEUVERING_JETS',
  name: 'Maneuvering Jets',
  description:
    "Before you assign hits produced by another player's Space Cannon roll: Cancel 1 hit.",
  params: {
    isEnabled: true,
    uses: 0,
  },
  headerUI: 'uses',
  invoke: [
    {
      timing: 'BEFORE_ASSIGN_HITS',
      context: ['SPACE_CANNON_OFFENSE', 'SPACE_CANNON_DEFENSE'],
      isCallable: (_params, ctx) => ctx.api.own.getPendingHits() > 0,
      call: ctx => {
        ctx.api.own.reduceHits(1)
      },
    },
  ],
}
