import type { Ability } from '@/combat'

export const custodiaVigilia: Ability = {
  key: 'CUSTODIA_VIGILIA',
  name: 'Custodia Vigilia',
  description:
    'While you control Mecatol Rex, it gains Space Cannon 5 and Production 3.',
  params: {
    isEnabled: false,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'BEFORE_UNIT_ABILITY_ROLL',
      context: ['SPACE_CANNON_OFFENSE', 'SPACE_CANNON_DEFENSE'],
      call: ctx => {
        ctx.api.own.addDiceGroup([5, 1])
      },
    },
  ],
}
