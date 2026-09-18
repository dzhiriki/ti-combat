import type { Ability } from '@/combat/abilities-engine/types'

export const cmorranNorr: Ability = {
  key: 'CMORRAN_NORR',
  name: "C'morran N'orr",
  description:
    "Apply +1 to the result of each of your other ship's combat rolls in this system.",
  context: 'SPACE',
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
        ctx.api.own.applyBonusToResult(1, { exclude: ['FLAGSHIP'] })
      },
    },
  ],
}
