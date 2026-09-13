import type { Ability } from '@/combat'

export const geoform: Ability = {
  key: 'GEOFORM',
  name: 'Geoform',
  description:
    'Ready Elysium and attach this card to it. It gains the Space Cannon 5 (x3) ability as if it were a unit.',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'BEFORE_UNIT_ABILITY_ROLL',
      context: ['SPACE_CANNON_OFFENSE', 'SPACE_CANNON_DEFENSE'],
      external: true,
      call: ctx => {
        ctx.api.own.addDiceGroup([5, 3])
      },
    },
  ],
}
