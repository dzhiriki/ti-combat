import type { Ability } from '@/combat'

// The Saint of Swords mech. While it is being transported, one of your units
// with a capacity value rolls 1 additional die on its combat rolls. Modeled as
// an opt-in toggle that adds 1 die to your best combat unit.
export const colada: Ability = {
  key: 'TF_COLADA',
  name: 'Colada',
  description:
    'While this unit is being transported, 1 of your units with a capacity value rolls 1 additional die on its combat rolls.',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      call: ctx => {
        ctx.api.own.addDiceCount(1, 'BEST')
      },
    },
  ],
}
