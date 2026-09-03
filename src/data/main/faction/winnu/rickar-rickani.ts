import winnuIcon from '@/assets/faction/winnu.svg?raw'
import type { Ability } from '@/combat/abilities-engine/types'

export const rickarRickani: Ability = {
  key: 'RICKAR_RICKANI',
  name: 'Rickar Rickani',
  description:
    "During combat: Apply +2 to the result of each of your unit's combat rolls in the Mecatol Rex system, your home system, and each system that contains a legendary planet.",
  icon: winnuIcon,
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      call: ctx => {
        ctx.api.own.applyBonusToResult(2)
      },
    },
  ],
}
