import type { Ability } from '@/combat/abilities-engine/types'

export const wrathOfKenara: Ability = {
  key: 'WRATH_OF_KENARA',
  name: 'Wrath of Kenara',
  description:
    'After you roll a die during a space combat in this system, you may spend 1 trade good to apply +1 to the result.',
  context: 'SPACE',
  params: {
    isEnabled: true,
    uses: 0,
  },
  headerUI: 'uses',
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      context: 'SPACE_COMBAT',
      system: true,
      isCallable: params => params.isEnabled && params.uses > 0,
      call: ctx => {
        ctx.api.own.applyConditionalBonusToResult({ amount: 1 })
      },
    },
  ],
}
