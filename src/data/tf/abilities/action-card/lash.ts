import {
  type Ability,
  type AbilityReadContext,
  type CombatMode,
  declareParam,
} from '@/combat'
import type { UnitId, UnitList, UnitType } from '@/types'

type Params = {
  spaceTriggers: UnitList<boolean>
  groundTriggers: UnitList<boolean>
  spaceTargetPriority: UnitList<boolean>
  groundTargetPriority: UnitList<boolean>
}

function modeKeys(mode: CombatMode) {
  return mode === 'GROUND'
    ? (['groundTriggers', 'groundTargetPriority'] as const)
    : (['spaceTriggers', 'spaceTargetPriority'] as const)
}

/** Highest COST among this side's own units destroyed in `ids` whose variant
 *  is checked in `triggers`, or undefined when no checked unit died. */
function maxTriggeredCost(
  ctx: AbilityReadContext,
  ids: UnitId[],
  triggers: string[],
): number | undefined {
  let max: number | undefined
  for (const id of ids) {
    const key = ctx.api.own.getUnitVariantKey(id)
    if (!key || !triggers.includes(key)) continue
    const cost = ctx.api.own.getUnitStats(key)?.COST
    if (typeof cost === 'number' && (max === undefined || cost > max)) {
      max = cost
    }
  }
  return max
}

/** Walk the target priority in list order; the first checked variant with a
 *  living unit and COST ≤ `threshold` wins (Vos Hollow's pattern). */
function findOpponentTarget(
  ctx: AbilityReadContext,
  priority: UnitType[],
  threshold: number,
): UnitId | undefined {
  for (const variant of priority) {
    const cost = ctx.api.opponent.getUnitStats(variant)?.COST
    if (typeof cost !== 'number' || cost > threshold) continue
    const [unit] = ctx.api.opponent.getUnits(variant, {
      includeVariants: true,
    })
    if (unit) return unit
  }
  return undefined
}

// Twilight's Fall action card. When one of your units is destroyed, destroy an
// opponent unit in the same system whose cost is equal to or lower than the
// lost unit's. Single-system calculator, so "in its system" is every
// participating unit. The trigger list picks which of your losses are worth
// the card (don't burn it on a fighter); the target list is a drag-ordered
// priority — the first checked type that fits under the cost threshold is
// destroyed (defaults to most-valuable-first).
export const lash: Ability<Params> = {
  key: 'TF_LASH',
  name: 'Lash',
  description:
    'When one of your units is destroyed: Destroy 1 of your opponent’s units in its system that has an equal or lower cost.',
  params: {
    isEnabled: false,
    uses: 1,
    spaceTriggers: declareParam<UnitList<boolean>>({
      default: [],
      source: 'spaceCombatParticipating',
      side: 'own',
      defaultItemValue: true,
      filter: { combatMode: 'SPACE' },
    }),
    groundTriggers: declareParam<UnitList<boolean>>({
      default: [],
      source: 'groundCombatParticipating',
      side: 'own',
      defaultItemValue: true,
      filter: { combatMode: 'GROUND' },
    }),
    spaceTargetPriority: declareParam<UnitList<boolean>>({
      default: [],
      source: 'spaceCombatParticipating',
      side: 'opponent',
      sort: 'worth-desc',
      defaultItemValue: true,
      filter: { combatMode: 'SPACE' },
    }),
    groundTargetPriority: declareParam<UnitList<boolean>>({
      default: [],
      source: 'groundCombatParticipating',
      side: 'opponent',
      sort: 'worth-desc',
      defaultItemValue: true,
      filter: { combatMode: 'GROUND' },
    }),
  },
  headerUI: 'isEnabled',
  uiConfig: ctx => {
    const [triggersKey, targetsKey] = modeKeys(ctx.state.combatMode)
    return [
      {
        key: triggersKey,
        label: 'Trigger on losing',
        type: 'unit-list',
        mode: 'checkbox',
        items: ctx.api.own.getUnitVariantsOptions(triggersKey),
      },
      {
        key: targetsKey,
        // Unlike Valiant/Courageous, Lash's owner picks the victim — this
        // list IS targeting: the first checked type under the cost cap dies.
        label: 'Destroy order',
        type: 'unit-list',
        mode: 'checkbox',
        sortable: true,
        items: ctx.api.opponent.getUnitVariantsOptions(targetsKey),
      },
    ]
  },
  invoke: [
    {
      timing: 'AFTER_DESTROY',
      isCallable: (params, ctx, ids) => {
        const [triggersKey, targetsKey] = modeKeys(ctx.state.combatMode)
        const threshold = maxTriggeredCost(
          ctx,
          ids,
          ctx.utils.getFlat(params[triggersKey]),
        )
        if (threshold === undefined) return false
        return (
          findOpponentTarget(
            ctx,
            ctx.utils.getFlat(params[targetsKey]),
            threshold,
          ) !== undefined
        )
      },
      call: (ctx, params, ids) => {
        const [triggersKey, targetsKey] = modeKeys(ctx.state.combatMode)
        const threshold = maxTriggeredCost(
          ctx,
          ids,
          ctx.utils.getFlat(params[triggersKey]),
        )
        if (threshold === undefined) return
        const target = findOpponentTarget(
          ctx,
          ctx.utils.getFlat(params[targetsKey]),
          threshold,
        )
        if (target) ctx.api.opponent.destroyUnits(target)
      },
    },
  ],
}
