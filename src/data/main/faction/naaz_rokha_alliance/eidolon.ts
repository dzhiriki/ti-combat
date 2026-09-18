import type { Ability } from '@/combat'

export const eidolon: Ability = {
  key: 'EIDOLON',
  name: 'Z-Grav Eidolon',
  description:
    'If this unit is in the space area of the active system, it is also a ship.',
  context: 'SPACE',
  params: {
    isEnabled: true,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  readOnly: true,
  declareParamChange: () => [{ key: 'ships', value: 'MECH' }],
  invoke: [
    {
      timing: 'START_OF_COMBAT',
      isCallable: (_params, ctx) =>
        ctx.api.own.getUnitSurface(ctx.getUnit()) ===
        ctx.api.own.getSpaceSurfaceId(),
      call: ctx => {
        const stats = ctx.api.own.getUnitStats('MECH')!
        // Modify all mechs to Z-Grav form: combat [8, 2], loses Sustain Damage
        ctx.api.own.modifyUnitType('MECH', {
          CATEGORIES: ['GROUND_FORCES', 'SHIPS'],
          COMBAT: [8, 2, stats.COMBAT![2] ?? 0],
          UNIT_ABILITIES: {},
          ABILITIES: [eidolon],
        })
      },
    },
  ],
}
