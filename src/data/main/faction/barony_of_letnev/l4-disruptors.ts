import type { Ability } from '@/combat/abilities-engine/types'

export const l4Disruptors: Ability = {
  key: 'L4_DISRUPTORS',
  name: 'L4 Disruptors',
  description:
    'During an invasion, units cannot use Space Cannon against your units.',
  context: 'GROUND',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'PREPARE',
      call: ctx => {
        ctx.api.opponent.setUnitAbilityCannotBeUsed(
          'SPACE_CANNON',
          ctx.this.key,
        )
      },
    },
  ],
}
