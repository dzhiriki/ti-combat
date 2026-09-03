import type { Ability } from '@/combat'

export const prophecyOfIxth: Ability = {
  key: 'PROPHECY_OF_IXTH',
  name: 'Prophecy of Ixth',
  description: "Apply +1 to the result of their fighter's combat rolls.",
  context: 'SPACE',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      call: ctx => {
        ctx.api.own.applyBonusToResult(1, 'FIGHTER')
      },
    },
  ],
}
