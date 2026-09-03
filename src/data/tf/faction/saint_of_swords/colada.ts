import type { Ability, AbilityReadContext } from '@/combat'
import { UNIT_TYPES } from '@/constants/units'
import type { UnitBaseType } from '@/types'

/** Fielded own units with a capacity value — the legal targets for the extra
 *  die. Anything that COSTS capacity (the mech itself, ground forces) is
 *  never a target. */
function capacityTargets(ctx: AbilityReadContext): UnitBaseType[] {
  const targets: UnitBaseType[] = []
  for (const baseType of UNIT_TYPES) {
    const stats = ctx.api.own.getUnitStats(baseType)
    if (!stats?.COMBAT) continue
    const capacity = stats.CAPACITY
    if (stats.CAPACITY_COST != null || capacity == null || capacity <= 0) {
      continue
    }
    if (ctx.api.own.countUnits(baseType, { includeVariants: true }) === 0) {
      continue
    }
    targets.push(baseType)
  }
  return targets
}

// The Saint of Swords mech. "While this unit is being transported, choose 1
// unit in its system that has a capacity value to roll 1 additional die on its
// combat rolls." The toggle asserts the mech is being transported; the target
// is chosen automatically each round — the strongest unit with a capacity
// value (lowest combat value, so the extra die hits most easily), re-picked
// per roll so the bonus moves on if the carrier dies. The die is added TO that
// unit's own dice rather than as a separate group, so per-unit effects see it
// (Crown of Thalnos' safe reroll covers the boosted ship's whole roll). Each
// transported mech grants one die (the invoke fires once per mech instance).
export const colada: Ability = {
  key: 'TF_COLADA',
  name: 'Colada',
  description:
    'While this unit is being transported, choose 1 unit in its system that has a capacity value to roll 1 additional die on its combat rolls.',
  context: 'SPACE',
  params: {
    isEnabled: true,
    uses: Infinity,
  },
  readOnly: true,
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      context: 'SPACE_COMBAT',
      isCallable: (_params, ctx) => capacityTargets(ctx).length > 0,
      call: ctx => {
        ctx.api.own.addDiceCount(1, 'BEST', capacityTargets(ctx))
      },
    },
  ],
}
