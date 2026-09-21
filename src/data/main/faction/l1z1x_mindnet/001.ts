import { parseVariantId } from '@/combat'
import type { Ability } from '@/combat/abilities-engine/types'
import type { UnitType } from '@/types'

export const zerozeroone: Ability = {
  key: '0_0_1',
  name: '[0.0.1]',
  description:
    'During a space combat, hits produced by this ship and by your dreadnoughts in this system must be assigned to non-fighter ships if able.',
  context: 'SPACE',
  params: {
    isEnabled: true,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  readOnly: true,
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      context: 'SPACE_COMBAT',
      call: ctx => {
        const abilityKey = ctx.this.key
        const { spaceUnitPriority: priority } =
          ctx.api.opponent.getAbilityConfig('UNIT_PRIORITY')
        const nonFighters: UnitType[] = []
        const fighters: UnitType[] = []
        for (const [key] of priority) {
          const target = key as UnitType
          if (parseVariantId(target).type === 'FIGHTER') {
            fighters.push(target)
          } else {
            nonFighters.push(target)
          }
        }
        const unitPriority = [...nonFighters, ...fighters]
        ctx.declareHitPoolTransform({
          OWN: {
            key: abilityKey,
            units: ['FLAGSHIP', 'DREADNOUGHT'],
            transform: count => ({ base: count, unitPriority }),
          },
        })
      },
    },
    {
      timing: 'DESTROY',
      context: 'SPACE_COMBAT',
      isCallable: (_params, ctx, destroyed) =>
        destroyed.includes(ctx.getUnit()),
      call: ctx => {
        // The restricted pool lives on the opponent's side (where the
        // hits land). When the flagship carrying [0.0.1] dies, drop the
        // restriction so any remaining hits in the pool can target any
        // ship (including fighters).
        ctx.api.opponent.liftHitPoolRestriction(ctx.this.key)
      },
    },
  ],
}
