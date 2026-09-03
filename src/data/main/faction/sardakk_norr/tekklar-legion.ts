import sardakkNorrIcon from '@/assets/faction/sardakk_norr.svg?raw'
import type { Ability } from '@/combat/abilities-engine/types'

export const tekklarLegion: Ability = {
  key: 'TEKKLAR_LEGION',
  name: 'Tekklar Legion',
  description:
    "At the start of an invasion combat: Apply +1 to the result of each of your unit's combat rolls during this combat. If your opponent is the N'orr player, apply -1 to the result of each of their combat rolls during this combat.",
  icon: sardakkNorrIcon,
  context: 'GROUND',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      context: 'GROUND_COMBAT',
      call: ctx => {
        ctx.api.own.applyBonusToResult(1)
        if (ctx.api.opponent.getFaction() === 'SARDAKK_NORR') {
          ctx.api.opponent.applyBonusToResult(-1)
        }
      },
    },
  ],
}
