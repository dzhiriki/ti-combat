import type { Ability } from '@/combat'

export const antimassDeflectors: Ability = {
  key: 'ANTIMASS_DEFLECTORS',
  name: 'Antimass Deflectors',
  description:
    "When other players' units use Space Cannon against your units, apply -1 to the result of each die roll.",
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'BEFORE_UNIT_ABILITY_ROLL',
      context: ['SPACE_CANNON_OFFENSE', 'SPACE_CANNON_DEFENSE'],
      call: ctx => {
        ctx.api.opponent.applyBonusToResult(-1)
      },
    },
  ],
}
