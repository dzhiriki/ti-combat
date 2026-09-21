import type { Ability } from '@/combat'
import type { UnitId } from '@/types/unit'

export const vanHauge: Ability = {
  key: 'VAN_HAUGE',
  name: 'Van Hauge',
  description: 'When this ship is destroyed, destroy all ships in this system.',
  context: 'SPACE',
  params: {
    isEnabled: true,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  readOnly: true,
  invoke: [
    {
      timing: 'WHEN_DESTROY',
      isCallable: (_params, ctx, ids) => ids.includes(ctx.getUnit()),
      call: ctx => {
        const ownSettings = ctx.api.own.getAbilityConfig('SETTINGS')
        const opSettings = ctx.api.opponent.getAbilityConfig('SETTINGS')

        const opIds: UnitId[] = opSettings.ships.flatMap(type =>
          ctx.api.opponent.getUnits(type, { includeVariants: true }),
        )

        const ownIds: UnitId[] = ownSettings.ships.flatMap(type =>
          ctx.api.own.getUnits(type, { includeVariants: true }),
        )

        ctx.api.opponent.destroyUnits(opIds)
        ctx.api.own.destroyUnits(ownIds)
      },
    },
  ],
}
