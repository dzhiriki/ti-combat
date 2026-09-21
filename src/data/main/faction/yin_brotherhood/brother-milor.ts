import yinBrotherhoodIcon from '@/assets/faction/yin_brotherhood.svg?raw'
import type { Ability } from '@/combat'

export const brotherMilor: Ability = {
  key: 'BROTHER_MILOR',
  name: 'Brother Milor',
  description:
    "After a player's unit is destroyed: You may exhaust this card to allow that player to place 2 fighters in the destroyed unit's system if it was a ship, or 2 infantry on its planet if it was a ground force.",
  icon: yinBrotherhoodIcon,
  params: {
    isEnabled: false,
    uses: 1,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'AFTER_DESTROY',
      context: ['SPACE_COMBAT', 'GROUND_COMBAT'],
      external: true,
      isCallable: (_params, ctx, ids) =>
        ids.some(id => !!ctx.api.own.getUnitVariantKey(id)),
      call: ctx => {
        if (ctx.state.combatMode === 'SPACE') {
          ctx.api.own.placeUnits({ FIGHTER: 2 })
        } else {
          ctx.api.own.placeUnits({ INFANTRY: 2 })
        }
      },
    },
  ],
}
