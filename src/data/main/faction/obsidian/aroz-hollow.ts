import obsidianIcon from '@/assets/faction/obsidian.svg?raw'
import type { Ability } from '@/combat/abilities-engine/types'

export const arozHollow: Ability = {
  key: 'AROZ_HOLLOW',
  name: 'Aroz Hollow',
  description:
    "Apply +1 to the result of each of your units' combat rolls in The Fracture.",
  icon: obsidianIcon,
  params: {
    isEnabled: false,
    uses: Infinity,
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
