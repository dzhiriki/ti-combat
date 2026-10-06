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
  // Only mechs on the planet being fought participate; in a multi-planet
  // invasion the others may still bombard (Harrow) from their own planets.
  invoke: [
    {
      timing: 'START_OF_COMBAT',
      context: 'GROUND_COMBAT',
      call: ctx => {
        ctx.api.own.setUnitAbilityCannotBeUsed(
          'BOMBARDMENT',
          ctx.this.key,
          'MECH',
          ctx.api.own.getActiveSurfaceId(),
        )
      },
    },
    {
      timing: 'END_OF_COMBAT',
      context: 'GROUND_COMBAT',
      call: ctx => {
        ctx.api.own.removeUnitAbilityCannotBeUsed(
          'BOMBARDMENT',
          ctx.this.key,
          'MECH',
          ctx.api.own.getActiveSurfaceId(),
        )
      },
    },
  ],
}
