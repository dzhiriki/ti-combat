import type { Ability } from '@/combat/abilities-engine/types'

export const unrelenting: Ability = {
  key: 'UNRELENTING',
  name: 'Unrelenting',
  description: "Apply +1 to the result of each of your unit's combat rolls.",
  params: {
    isEnabled: true,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  readOnly: true,
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      call: ctx => {
        ctx.api.own.applyBonusToResult(1)
      },
    },
  ],
}
