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
  invoke: [
    {
      timing: 'WHEN_INDOCTRINATION',
      isCallable: (_params, ctx) => {
        return (
          ctx.api.own.countUnits('MECH', { includeVariants: true }) <
          UNIT_LIMITS.MECH
        )
      },
      call: (ctx, _params, placedId) => {
        ctx.api.own.removeUnits(placedId)
        ctx.api.own.placeUnits({ MECH: 1 })
      },
    },
  ],
}
