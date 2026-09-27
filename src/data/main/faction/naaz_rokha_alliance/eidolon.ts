import type { Ability } from '@/combat'
import { SPACE_SURFACE_ID } from '@/types'

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
  declareChanges: ctx => {
    ctx.api.own.modifyUnitType('MECH', {
      CATEGORIES: ['GROUND_FORCES', 'SHIPS'],
    })
  },
  invoke: [
    {
      timing: 'START_OF_COMBAT',
      isCallable: (_params, ctx) =>
        ctx.api.own.getUnitSurface(ctx.getUnit()) === SPACE_SURFACE_ID,
      call: ctx => {
        const stats = ctx.api.own.getUnitStats('MECH')!
        ctx.invokeChanges()
        // Modify all mechs to Z-Grav form: combat [8, 2], loses Sustain Damage
        ctx.api.own.modifyUnitType('MECH', {
          COMBAT: [8, 2, stats.COMBAT![2] ?? 0],
          UNIT_ABILITIES: {},
          ABILITIES: [eidolon],
        })
      },
    },
  ],
}
