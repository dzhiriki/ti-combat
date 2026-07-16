import type { Ability, AbilityReadContext } from '@/combat'
import type { UnitId } from '@/types'

type Params = { isEnabled: boolean }

/** Highest COST among this side's own units destroyed in `ids`, or undefined
 *  if none of the destroyed units belong to this side. */
function maxOwnDestroyedCost(
  ctx: AbilityReadContext,
  ids: UnitId[],
): number | undefined {
  let max: number | undefined
  for (const id of ids) {
    const key = ctx.api.own.getUnitVariantKey(id)
    if (!key) continue // not one of our units
    const cost = ctx.api.own.getUnitStats(key)?.COST
    if (typeof cost === 'number' && (max === undefined || cost > max)) {
      max = cost
    }
  }
  return max
}

/** The most valuable opponent unit whose COST is ≤ `threshold`. */
function findOpponentTarget(
  ctx: AbilityReadContext,
  threshold: number,
): UnitId | undefined {
  let best: UnitId | undefined
  let bestCost = -1
  for (const type of ctx.api.opponent.getParticipatingUnitTypes()) {
    const cost = ctx.api.opponent.getUnitStats(type)?.COST
    if (typeof cost !== 'number' || cost > threshold || cost <= bestCost) {
      continue
    }
    const [unit] = ctx.api.opponent.getUnits(type, { includeVariants: true })
    if (unit) {
      best = unit
      bestCost = cost
    }
  }
  return best
}

// Twilight's Fall action card. When one of your units is destroyed, destroy an
// opponent unit in the same system whose cost is equal to or lower than the
// lost unit's. Single-system calculator, so "in its system" is every
// participating unit.
export const lash: Ability<Params> = {
  key: 'TF_LASH',
  name: 'Lash',
  description:
    'When one of your units is destroyed: Destroy 1 of your opponent’s units in its system that has an equal or lower cost.',
  params: {
    isEnabled: false,
    uses: 1,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'AFTER_DESTROY',
      isCallable: (_params, ctx, ids) => {
        const threshold = maxOwnDestroyedCost(ctx, ids)
        if (threshold === undefined) return false
        return findOpponentTarget(ctx, threshold) !== undefined
      },
      call: (ctx, _params, ids) => {
        const threshold = maxOwnDestroyedCost(ctx, ids)
        if (threshold === undefined) return
        const target = findOpponentTarget(ctx, threshold)
        if (target) ctx.api.opponent.destroyUnits(target)
      },
    },
  ],
}
