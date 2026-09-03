import type { Ability } from '@/combat/abilities-engine/types'

export const arviconRex: Ability = {
  key: 'ARVICON_REX',
  name: 'Arvicon Rex',
  description:
    "During combat against an opponent whose command token is not in your fleet pool, apply +2 to the results of this unit's combat rolls.",
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
