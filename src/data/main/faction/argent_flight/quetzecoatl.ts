import type { Ability } from '@/combat/abilities-engine/types'

export const quetzecoatl: Ability = {
  key: 'QUETZECOATL',
  name: 'Quetzecoatl',
  description:
    'Other players cannot use Space Cannon against your ships in this system.',
  context: 'SPACE',
  params: {
    isEnabled: true,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  readOnly: true,
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
