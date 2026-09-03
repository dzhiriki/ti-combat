import type { Ability } from '@/combat'

export const harrow: Ability = {
  key: 'HARROW',
  name: 'Harrow',
  description:
    'At the end of each round of ground combat, your ships in the active system may use their Bombardment abilities against your opponent’s ground forces on the planet.',
  context: 'GROUND',
  side: 'attacker',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'END_OF_COMBAT_ROUND',
      context: 'GROUND_COMBAT',
      call: ctx => {
        ctx.resolveStep('BOMBARDMENT')
      },
    },
  ],
}
