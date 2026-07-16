import type { Ability, AbilityReadContext } from '@/combat'
import { UNIT_WORTH } from '@/constants/units'
import type { UnitBaseType, UnitId, UnitType } from '@/types'

// A target is eligible for Linkship's retreat destroy if it is damaged OR does
// not (effectively) have Sustain Damage.
function isEligible(ctx: AbilityReadContext, id: UnitId): boolean {
  if (ctx.api.opponent.getUnitState(id)?.isDamaged) return true
  const stats = ctx.api.opponent.getUnitStats(id)
  if (!stats?.UNIT_ABILITIES?.SUSTAIN_DAMAGE) return true
  const variantKey = ctx.api.opponent.getUnitVariantKey(id)
  if (!variantKey) return false
  return (
    ctx.api.opponent.isUnitAbilityLost('SUSTAIN_DAMAGE', variantKey) ||
    ctx.api.opponent.isUnitAbilityCannotBeUsed('SUSTAIN_DAMAGE', variantKey)
  )
}

// The highest-worth eligible opponent ship (the best thing to pick off).
function bestTarget(ctx: AbilityReadContext): UnitId | undefined {
  const { ships } = ctx.api.opponent.getAbilityConfig('SETTINGS')
  let best: UnitId | undefined
  let bestWorth = -1
  for (const shipType of ships) {
    for (const id of ctx.api.opponent.getUnits(shipType as UnitType, {
      includeVariants: true,
    })) {
      if (!isEligible(ctx, id)) continue
      const baseType = ctx.api.opponent.getUnitBaseType(id)
      const worth = baseType ? (UNIT_WORTH[baseType] ?? 0) : 0
      if (worth > bestWorth) {
        bestWorth = worth
        best = id
      }
    }
  }
  return best
}

// Fires once per retreating Linkship destroyer (WHEN_RETREAT is triggered per
// unit). Attached to the Linkship upgrade ability, so it only runs while that
// upgrade is enabled.
export const linkshipRetreatInvoke: Ability['invoke'][number] = {
  timing: 'WHEN_RETREAT',
  isCallable: (_params, ctx, unitId) => {
    const key = ctx.api.own.getUnitVariantKey(unitId)
    if (!key || (key.split(':')[0] as UnitBaseType) !== 'DESTROYER')
      return false
    return bestTarget(ctx) !== undefined
  },
  call: ctx => {
    const target = bestTarget(ctx)
    if (target) ctx.api.opponent.destroyUnits(target)
  },
}
