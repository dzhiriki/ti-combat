import type { Ability } from '@/combat/abilities-engine/types'
import type { UnitBaseType } from '@/types'

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
  invoke: [
    {
      timing: 'PREPARE',
      call: ctx => {
        ctx.api.own.updateAbilityConfig('FRAGILE', {
          excludeUnits: (current: UnitBaseType[] = []) => [
            ...current,
            'INFANTRY',
          ],
        })
      },
    },
    {
      timing: 'AFTER_DESTROY',
      isCallable: (_params, ctx) =>
        !ctx.api.own.hasUnitType('MECH', { includeVariants: true }),
      call: ctx => {
        ctx.api.own.updateAbilityConfig('FRAGILE', {
          excludeUnits: (current: UnitBaseType[] = []) =>
            current.filter(u => u !== 'INFANTRY'),
        })
      },
    },
  ],
}
