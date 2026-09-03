import type { Ability } from '@/combat/abilities-engine/types'

export const assail: Ability = {
  key: 'ASSAIL',
  name: 'Assail',
  description:
    'Apply +1 to the results of each of your combat and unit ability rolls against the puppeted player.',
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
    {
      timing: 'BEFORE_UNIT_ABILITY_ROLL',
      call: ctx => {
        ctx.api.own.applyBonusToResult(1)
      },
    },
  ],
}
