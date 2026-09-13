import type { Ability } from '@/combat/abilities-engine/types'

export const mollTerminus: Ability = {
  key: 'MOLL_TERMINUS',
  name: 'Moll Terminus',
  description:
    "Other players' ground forces on this planet cannot use Sustain Damage.",
  context: 'GROUND',
  params: {
    isEnabled: true,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  readOnly: true,
  invoke: [
    {
      timing: 'COMMIT_UNITS',
      isCallable: (_params, ctx) =>
        ctx.api.own.getUnitSurface(ctx.getUnit()) ===
        ctx.api.own.getActiveSurfaceId(),
      call: ctx => {
        ctx.api.opponent.setUnitAbilityCannotBeUsed(
          'SUSTAIN_DAMAGE',
          `${ctx.this.key}_${ctx.getUnit()}`,
        )
      },
    },
    {
      timing: 'DESTROY',
      isCallable: (_params, ctx, ids) => ids.includes(ctx.getUnit()),
      call: ctx => {
        ctx.api.opponent.removeUnitAbilityCannotBeUsed(
          'SUSTAIN_DAMAGE',
          `${ctx.this.key}_${ctx.getUnit()}`,
        )
      },
    },
  ],
}
