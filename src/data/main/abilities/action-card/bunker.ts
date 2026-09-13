import type { Ability } from '@/combat'

export const bunker: Ability = {
  key: 'BUNKER',
  name: 'Bunker',
  description:
    'At the start of an invasion: During this invasion, apply -4 to the result of each Bombardment roll against planets you control.',
  context: 'GROUND',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  side: 'defender',
  invoke: [
    {
      timing: 'BEFORE_UNIT_ABILITY_ROLL',
      context: 'BOMBARDMENT',
      call: ctx => {
        ctx.api.opponent.applyBonusToResult(-4)
      },
    },
  ],
}
