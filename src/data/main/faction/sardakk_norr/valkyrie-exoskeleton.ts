import type { Ability } from '@/combat'

export const valkyrieExoskeleton: Ability = {
  key: 'VALKYRIE_EXOSKELETON',
  name: 'Valkyrie Exoskeleton',
  description:
    "After this unit uses its Sustain Damage ability during ground combat, it produces 1 hit against your opponent's ground forces on this planet.",
  context: 'GROUND',
  params: {
    isEnabled: true,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  readOnly: true,
  invoke: [
    {
      timing: 'AFTER_SUSTAIN_DAMAGE_USE',
      context: 'GROUND_COMBAT',
      isCallable: (_params, ctx, unitId) => unitId === ctx.getUnit(),
      call: ctx => {
        ctx.api.opponent.addHits(1)
      },
    },
  ],
}
