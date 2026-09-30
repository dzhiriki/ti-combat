import type { Ability } from '@/combat'

export const reflectiveShielding: Ability = {
  key: 'REFLECTIVE_SHIELDING',
  name: 'Reflective Shielding',
  description:
    "When one of your ships uses Sustain Damage during combat: Produce 2 hits against your opponent's ships in the active system.",
  context: 'SPACE',
  params: {
    isEnabled: false,
    uses: 1,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'WHEN_SUSTAIN_DAMAGE_USE',
      context: 'SPACE_COMBAT',
      isCallable: (_params, ctx, unitId) =>
        ctx.api.own.isUnitCategory(unitId, 'SHIPS'),
      call: ctx => {
        ctx.api.opponent.addHits(2)
      },
    },
  ],
}
