import type { Ability } from '@/combat'

export const disable: Ability = {
  key: 'DISABLE',
  name: 'Disable',
  description:
    "At the start of an invasion in a system that contains 1 or more of your opponents' PDS units: Your opponents' PDS units lose Planetary Shield and Space Cannon during this invasion.",
  context: 'GROUND',
  params: {
    isEnabled: false,
    uses: 1,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'PREPARE',
      call: ctx => {
        ctx.api.opponent.setUnitAbilityLost(
          'PLANETARY_SHIELD',
          ctx.this.key,
          'PDS',
        )
        ctx.api.opponent.setUnitAbilityLost('SPACE_CANNON', ctx.this.key, 'PDS')
      },
    },
  ],
}
