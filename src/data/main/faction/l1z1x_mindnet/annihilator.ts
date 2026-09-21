import type { Ability } from '@/combat'

export const annihilator: Ability = {
  key: 'ANNIHILATOR',
  name: 'Annihilator',
  description:
    'While not participating in ground combat, this unit can use its Bombardment ability on planets in its system as if it were a ship.',
  params: {
    isEnabled: true,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  readOnly: true,
  invoke: [
    {
      timing: 'COMMIT_UNITS',
      call: ctx => {
        ctx.api.own.setUnitAbilityCannotBeUsed(
          'BOMBARDMENT',
          ctx.this.key,
          'MECH',
        )
      },
    },
  ],
}
