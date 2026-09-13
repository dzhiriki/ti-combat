import type { Ability } from '@/combat/abilities-engine/types'

export const viszElVir: Ability = {
  key: 'VISZ_EL_VIR',
  name: 'Visz El Vir',
  description: 'Your mechs in this system roll 1 additional die during combat.',
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
        const stats = ctx.api.own.getUnitStats('MECH')!

        ctx.api.own.modifyUnitType('MECH', {
          COMBAT: [
            stats.COMBAT![0],
            stats.COMBAT![1],
            stats.COMBAT![2] ?? 0 + 1,
          ],
        })
      },
    },
    {
      timing: 'DESTROY',
      isCallable: (_params, ctx, ids) => ids.includes(ctx.getUnit()),
      call: ctx => {
        const stats = ctx.api.own.getUnitStats('MECH')!

        ctx.api.own.modifyUnitType('MECH', {
          COMBAT: [stats.COMBAT![0], stats.COMBAT![1], stats.COMBAT![2]! - 1],
        })
      },
    },
  ],
}
