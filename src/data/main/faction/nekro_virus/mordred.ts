import type { Ability } from '@/combat/abilities-engine/types'

export const mordred: Ability = {
  key: 'MORDRED',
  name: 'Mordred',
  description:
    'During combat against an opponent who has an "X" or "Y" token on 1 or more of their technologies, apply +2 to the result of each of this unit\'s combat rolls.',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      call: ctx => {
        ctx.api.own.applyBonusToResult(
          2,
          ctx.api.own.getUnitBaseType(ctx.getUnit()),
        )
      },
    },
  ],
}
