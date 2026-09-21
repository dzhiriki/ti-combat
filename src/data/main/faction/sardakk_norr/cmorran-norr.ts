import type { Ability } from '@/combat/abilities-engine/types'

export const cmorranNorr: Ability = {
  key: 'CMORRAN_NORR',
  name: "C'morran N'orr",
  description:
    "Apply +1 to the result of each of your other ship's combat rolls in this system.",
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
        const settings = ctx.api.own.getAbilityConfig('SETTINGS')
        const ships = settings?.ships ?? []
        for (const shipType of ships) {
          if (shipType === 'FLAGSHIP') continue
          ctx.api.own.applyBonusToResult(1, shipType)
        }
      },
    },
  ],
}
