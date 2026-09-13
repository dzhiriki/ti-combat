import type { Ability } from '@/combat/abilities-engine/types'

export const jnsHylarim: Ability = {
  key: 'JNS_HYLARIM',
  name: 'J.N.S. Hylarim',
  description:
    'When making a combat roll for this ship, each result of 9 or 10, before applying modifiers, produces 2 additional hits.',
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
      context: 'SPACE_COMBAT',
      call: ctx => {
        ctx.api.own.declareRollTrigger({
          unitType: [ctx.api.own.getUnitVariantKey(ctx.getUnit())!],
          faces: [9, 10],
          effect: (count, branchCtx) => {
            branchCtx.api.opponent.addHits(count * 2)
          },
        })
      },
    },
  ],
}
