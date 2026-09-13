import type { Ability } from '@/combat'

export const fighterPrototype: Ability = {
  key: 'FIGHTER_PROTOTYPE',
  name: 'Fighter Prototype',
  description:
    "At the start of the first round of a space combat: Apply +2 to the result of each of your fighters' combat rolls during this combat round.",
  context: 'SPACE',
  params: {
    isEnabled: false,
    uses: 1,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'START_OF_COMBAT',
      call: ctx => {
        ctx.api.own.applyBonusToResult(2, 'FIGHTER')
      },
    },
  ],
}
