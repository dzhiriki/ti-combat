import type { Ability } from '@/combat/abilities-engine/types'

export const supercharge: Ability = {
  key: 'SUPERCHARGE',
  name: 'Supercharge',
  description:
    "At the start of a combat round, you may exhaust this card to apply +1 to the result of each of your unit's combat rolls during this combat round.",
  params: {
    isEnabled: false,
    uses: 1,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      call: ctx => {
        ctx.api.own.applyBonusToResult(1)
      },
    },
  ],
}
