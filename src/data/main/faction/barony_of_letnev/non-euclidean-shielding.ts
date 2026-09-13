import type { Ability } from '@/combat/abilities-engine/types'

export const nonEuclideanShielding: Ability = {
  key: 'NON_EUCLIDEAN_SHIELDING',
  name: 'Non-Euclidean Shielding',
  description:
    'When 1 of your units uses Sustain Damage, cancel 2 hits instead of 1.',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'WHEN_SUSTAIN_DAMAGE_USE',
      isCallable: (_, ctx, unitId) => ctx.api.own.hasUnit(unitId),
      call: ctx => {
        ctx.api.own.reduceHits(1)
      },
    },
  ],
}
