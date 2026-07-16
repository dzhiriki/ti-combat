import type { Ability } from '@/combat'
import type { UnitId } from '@/types'

// Twilight's Fall action card. When your flagship is destroyed, purge it and
// destroy all other units in its system — in the single-system space-combat
// model, every remaining ship on both sides. Modeled on Yin's Van Hauge
// flagship, but triggered as an action card when your own flagship dies.
export const atomize: Ability = {
  key: 'TF_ATOMIZE',
  name: 'Atomize',
  description:
    'When your flagship is destroyed: Purge your flagship and destroy all other units in its system.',
  context: 'SPACE',
  params: {
    isEnabled: false,
    uses: 1,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'AFTER_DESTROY',
      isCallable: (_params, ctx, ids) =>
        ids.some(id => {
          const key = ctx.api.own.getUnitVariantKey(id)
          return key != null && key.split(':')[0] === 'FLAGSHIP'
        }),
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
