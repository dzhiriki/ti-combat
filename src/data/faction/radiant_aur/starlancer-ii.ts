import type { Ability } from '@/combat'

// Radiant Aur mech. At the start of each round of ground combat you may spend a
// strategy token to repair all of your mechs. Modeled as an opt-in toggle that
// un-damages every own mech at the start of each ground-combat round.
export const starlancerII: Ability = {
  key: 'TF_STARLANCER_II',
  name: 'Starlancer II',
  description:
    'At the start of each round of ground combat, you may spend 1 token from your strategy pool to repair all of your mechs.',
  context: 'GROUND',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'START_OF_COMBAT_ROUND',
      context: 'GROUND_COMBAT',
      isCallable: (_params, ctx) =>
        ctx.api.own
          .getUnits('MECH', { includeVariants: true })
          .some(id => ctx.api.own.getUnitState(id)?.isDamaged),
      call: ctx => {
        for (const id of ctx.api.own.getUnits('MECH', {
          includeVariants: true,
        })) {
          if (ctx.api.own.getUnitState(id)?.isDamaged) {
            ctx.api.own.modifyUnitState(id, { isDamaged: false })
          }
        }
      },
    },
  ],
}
