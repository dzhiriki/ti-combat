import type { Ability } from '@/combat'

export const metaliVoidArmaments: Ability = {
  key: 'METALI_VOID_ARMAMENTS',
  name: 'Metali Void Armaments',
  description:
    "During the Anti-Fighter Barrage step of space combat, you may resolve Anti-Fighter Barrage 6 (x3) against your opponent's units.",
  context: 'SPACE',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'BEFORE_UNIT_ABILITY_ROLL',
      context: 'AFB',
      call: ctx => {
        ctx.api.own.addDiceGroup([6, 3])
      },
    },
  ],
}
