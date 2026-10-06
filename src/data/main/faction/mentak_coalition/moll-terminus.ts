import type {
  Ability,
  AbilityReadContext,
} from '@/combat/abilities-engine/types'
import { SPACE_SURFACE_ID, type SurfaceId } from '@/types'

/** The planet this mech fights on: where it stands, or the invaded planet
 *  when the attacker commits it from space. */
function mechPlanet(ctx: AbilityReadContext): SurfaceId | undefined {
  const surface = ctx.api.own.getUnitSurface(ctx.getUnit())
  if (surface !== SPACE_SURFACE_ID) return surface
  return ctx.side === 'attacker' ? ctx.api.own.getActiveSurfaceId() : undefined
}

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
      isCallable: (_params, ctx) => mechPlanet(ctx) !== undefined,
      call: ctx => {
        ctx.api.opponent.setUnitAbilityCannotBeUsed(
          'SUSTAIN_DAMAGE',
          `${ctx.this.key}_${ctx.getUnit()}`,
          undefined,
          mechPlanet(ctx),
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
          undefined,
          ctx.api.own.getUnitSurface(ctx.getUnit()),
        )
      },
    },
  ],
}
