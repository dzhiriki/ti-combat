import type { Ability } from '@/combat/abilities-engine/types'

export const salaiSaiCorian: Ability = {
  key: 'SALAI_SAI_CORIAN',
  name: 'Salai Sai Corian',
  description:
    "When this unit makes a combat roll, it rolls a number of dice equal to the number of your opponent's non-fighter ships in this system.",
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
        let nonFighterCount = 0
        for (const type of ctx.api.opponent.getParticipatingUnitTypes()) {
          if (type === 'FIGHTER') continue
          nonFighterCount += ctx.api.opponent.countUnits(type, {
            includeVariants: true,
          })
        }

        const variantKey = ctx.api.own.getUnitVariantKey(ctx.getUnit())!
        ctx.api.own.setDiceCount(nonFighterCount, variantKey)
      },
    },
  ],
}
