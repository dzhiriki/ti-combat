import type { Ability } from '@/combat'

export const solarFlare: Ability = {
  key: 'SOLAR_FLARE',
  name: 'Solar Flare',
  description:
    'After you activate a system: During this movement, other players cannot use Space Cannon against your ships.',
  context: 'SPACE',
  params: {
    isEnabled: false,
    uses: 1,
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
