import type { Ability } from '@/combat'
import { retreatUnits } from '@/data/main/abilities/advanced/retreat'
import type { UnitId } from '@/types'

// Twilight's Fall action card. "When you announce a retreat: Your units
// immediately retreat to an eligible system; do not place a command token in
// that system." Normally an announced retreat resolves at the END of the
// combat round — the fleet still eats one round of dice. Feint pulls the
// retreat forward to the announcement itself, so the round is never fought.
// Enable RETREAT (with its round setting) to announce; Feint fires at that
// round's announce step, before dice are rolled. The command-token clause is
// out of combat scope.
export const feint: Ability = {
  key: 'TF_FEINT',
  name: 'Feint',
  description:
    'When you announce a retreat: Your units immediately retreat to an eligible system; do not place a command token in that system.',
  context: 'SPACE',
  params: {
    isEnabled: false,
    uses: 1,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'ANNOUNCE_RETREAT_STEP',
      isCallable: (_params, ctx) => {
        const retreat = ctx.api.own.getAbilityConfig('RETREAT')
        return (
          retreat?.isEnabled === true && retreat._currentRound >= retreat.rounds
        )
      },
      call: ctx => {
        const allIds: UnitId[] = []
        for (const type of ctx.api.own.participating.getUnitTypes()) {
          allIds.push(
            ...ctx.api.own.participating.getUnits(type, {
              includeVariants: true,
            }),
          )
        }

        ctx.transitionTo('COMPLETE', 'LOST')
        retreatUnits(ctx, allIds)
      },
    },
  ],
}
