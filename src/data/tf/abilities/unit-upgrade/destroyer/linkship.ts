import ralNelIcon from '@/assets/faction/ral_nel.svg?raw'
import type { Ability, AbilityReadContext } from '@/combat'
import { UNIT_WORTH } from '@/constants/units'
import type { UnitId } from '@/types'
import { createStatsInvoke } from '@/utils/create-stats-invoke'

// A target is eligible for Linkship's retreat destroy if it is damaged OR does
// not (effectively) have Sustain Damage.
function isEligible(ctx: AbilityReadContext, id: UnitId): boolean {
  if (ctx.api.opponent.getUnitState(id)?.isDamaged) return true
  const stats = ctx.api.opponent.getUnitStats(id)
  if (!stats?.UNIT_ABILITIES?.SUSTAIN_DAMAGE) return true
  const variantKey = ctx.api.opponent.getUnitVariantKey(id)
  if (!variantKey) return false
  return ctx.api.opponent.isUnitAbilityDisabled('SUSTAIN_DAMAGE', id)
}

// The highest-worth eligible opponent ship (the best thing to pick off).
function bestTarget(ctx: AbilityReadContext): UnitId | undefined {
  let best: UnitId | undefined
  let bestWorth = -1
  for (const id of ctx.api.opponent.participating.getUnits()) {
    if (!isEligible(ctx, id)) continue
    const baseType = ctx.api.opponent.getUnitBaseType(id)
    const worth = baseType ? (UNIT_WORTH[baseType] ?? 0) : 0
    if (worth > bestWorth) {
      bestWorth = worth
      best = id
    }
  }
  return best
}

// Fires for each retreating unit that carries the text (WHEN_RETREAT is
// triggered per unit): the Linkship destroyers, and The Faces of Janovet,
// which copies it along with the stat block.
const linkshipText: Ability = {
  key: 'TF_UPGRADE_LINKSHIP',
  icon: ralNelIcon,
  name: 'Linkship',
  description:
    'When this unit retreats, you may destroy 1 ship in the active system that is damaged or does not have Sustain Damage.',
  params: { isEnabled: false, uses: Infinity },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'WHEN_RETREAT',
      isCallable: (_params, ctx, unitId) =>
        unitId === ctx.getUnit() && bestTarget(ctx) !== undefined,
      call: ctx => {
        const target = bestTarget(ctx)
        if (target) ctx.api.opponent.destroyUnits(target)
      },
    },
  ],
}

const statsInvoke = createStatsInvoke('DESTROYER', {
  COST: 1,
  COMBAT: [8, 1],
  MOVE: 2,
  UNIT_ABILITIES: { AFB: [6, 3] },
  ABILITIES: [linkshipText],
})

// The card registers the text's params and applies the stat block.
export const linkship: Ability = {
  ...linkshipText,
  exclusiveGroup: 'UNIT_UPGRADE_DESTROYER',
  invoke: [statsInvoke],
}
