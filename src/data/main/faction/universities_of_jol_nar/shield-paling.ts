import type { Ability } from '@/combat/abilities-engine/types'
import type { UnitBaseType } from '@/types'

const withoutInfantry = (current: UnitBaseType[] = []) =>
  current.filter(u => u !== 'INFANTRY')

export const shieldPaling: Ability = {
  key: 'SHIELD_PALING',
  name: 'Shield Paling',
  description:
    'Your infantry on this planet are not affected by your Fragile faction ability.',
  context: 'GROUND',
  params: {
    isEnabled: true,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  readOnly: true,
  // Fragile only affects combat rolls, so each planet's ground combat
  // checks for a mech on that planet.
  invoke: [
    {
      timing: 'START_OF_COMBAT',
      context: 'GROUND_COMBAT',
      isCallable: (_params, ctx) =>
        ctx.api.own.getUnitSurface(ctx.getUnit()) ===
        ctx.api.own.getActiveSurfaceId(),
      call: ctx => {
        ctx.api.own.updateAbilityConfig('FRAGILE', {
          excludeUnits: (current: UnitBaseType[] = []) => [
            ...withoutInfantry(current),
            'INFANTRY',
          ],
        })
      },
    },
    {
      timing: 'AFTER_DESTROY',
      isCallable: (_params, ctx) =>
        !ctx.api.own.surface.hasUnitType('MECH', {
          includeVariants: true,
        }),
      call: ctx => {
        ctx.api.own.updateAbilityConfig('FRAGILE', {
          excludeUnits: withoutInfantry,
        })
      },
    },
    {
      timing: 'END_OF_COMBAT',
      context: 'GROUND_COMBAT',
      call: ctx => {
        ctx.api.own.updateAbilityConfig('FRAGILE', {
          excludeUnits: withoutInfantry,
        })
      },
    },
  ],
}
