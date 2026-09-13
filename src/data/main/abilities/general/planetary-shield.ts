import type { Ability } from '@/combat'

export const planetaryShield: Ability = {
  key: 'PLANETARY_SHIELD',
  name: 'Planetary Shield',
  params: {
    isEnabled: true,
    uses: Infinity,
  },
  side: 'defender',
  invoke: [
    {
      timing: 'PREPARE',
      call: ctx => {
        ctx.api.opponent.setUnitAbilityCannotBeUsed('BOMBARDMENT', ctx.this.key)
      },
    },
  ],
}
