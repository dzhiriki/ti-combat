import type { Ability } from '@/combat'

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
        const opIds = ctx.api.opponent.participating.getUnits(undefined, {
          includeVariants: true,
        })
        const ownIds = ctx.api.own.participating.getUnits(undefined, {
          includeVariants: true,
        })

        ctx.api.opponent.destroyUnits(opIds)
        ctx.api.own.destroyUnits(ownIds)
      },
    },
  ],
}
