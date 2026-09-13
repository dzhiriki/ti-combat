import type { Ability } from '@/combat'

export const moraleBoost: Ability = {
  key: 'MORALE_BOOST',
  name: 'Morale Boost',
  description:
    "At the start of a combat round: Apply +1 to the result of each of your unit's combat rolls during this combat round.",
  params: {
    isEnabled: true,
    uses: 0,
  },
  headerUI: 'uses',
  invoke: [
    {
      timing: 'START_OF_COMBAT_ROUND',
      call: ctx => {
        ctx.api.own.applyBonusToResult(1)
      },
    },
  ],
}
