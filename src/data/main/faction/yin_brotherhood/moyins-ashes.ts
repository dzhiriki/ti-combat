import type { Ability } from '@/combat'
import { UNIT_LIMITS } from '@/constants/units'

export const moyinsAshes: Ability = {
  key: 'MOYINS_ASHES',
  name: "Moyin's Ashes",
  context: 'GROUND',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  // Replaces the infantry Indoctrination places on the active planet.
  declareChanges: ctx => {
    ctx.api.own.placeUnits({ MECH: 1 })
  },
  invoke: [
    {
      timing: 'WHEN_INDOCTRINATION',
      isCallable: (_params, ctx) => {
        return (
          ctx.api.own.system.countUnits('MECH', { includeVariants: true }) <
          UNIT_LIMITS.MECH
        )
      },
      call: (ctx, _params, placedId) => {
        const surface = ctx.api.own.getUnitSurface(placedId)
        ctx.api.own.removeUnits(placedId)
        ctx.api.own.placeUnits(
          { MECH: 1 },
          surface ?? ctx.api.own.getActiveSurfaceId(),
        )
      },
    },
  ],
}
