import { type Ability, type AbilityReadContext, declareParam } from '@/combat'
import type { UnitId, UnitList, UnitType } from '@/types'

type Params = {
  targetPriority: UnitList<boolean>
}

export const lastDispatch: Ability<Params> = {
  key: 'LAST_DISPATCH',
  name: 'Last Dispatch',
  description:
    'When this unit retreats, you may destroy 1 ship in the active system that does not have Sustain Damage.',
  context: 'SPACE',
  params: {
    isEnabled: true,
    uses: Infinity,
    targetPriority: declareParam<UnitList<boolean>>({
      default: [],
      source: 'ships',
      side: 'opponent',
      sort: 'worth-desc',
      defaultItemValue: true,
    }),
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'WHEN_RETREAT',
      isCallable: (_params, ctx, unitId) => {
        if (unitId !== ctx.getUnit()) return false

        // Check there's at least 1 eligible opponent ship
        const { ships } = ctx.api.opponent.getAbilityConfig('SETTINGS')
        for (const shipType of ships) {
          const ids = ctx.api.opponent.getUnits(shipType as UnitType, {
            includeVariants: true,
          })
          for (const id of ids) {
            if (isEligibleTarget(ctx, id)) return true
          }
        }
        return false
      },
      call: (ctx, params) => {
        for (const variantId of ctx.utils.getFlat(params.targetPriority)) {
          const ids = ctx.api.opponent.getUnits(variantId, {
            includeVariants: true,
          })
          for (const id of ids) {
            if (isEligibleTarget(ctx, id)) {
              ctx.api.opponent.destroyUnits(id)
              return
            }
          }
        }
      },
    },
  ],
  uiConfig: ctx => [
    {
      key: 'targetPriority',
      type: 'unit-list',
      mode: 'checkbox',
      sortable: true,
      items: ctx.api.opponent.getUnitVariantsOptions('targetPriority'),
    },
  ],
}

function isEligibleTarget(ctx: AbilityReadContext, unitId: UnitId) {
  const stats = ctx.api.opponent.getUnitStats(unitId)
  if (!stats?.UNIT_ABILITIES?.SUSTAIN_DAMAGE) return true
  // Has sustain in stats, but check if it's been restricted (lost/disabled)
  const variantKey = ctx.api.opponent.getUnitVariantKey(unitId)
  if (!variantKey) return false
  return (
    ctx.api.opponent.isUnitAbilityLost('SUSTAIN_DAMAGE', variantKey) ||
    ctx.api.opponent.isUnitAbilityCannotBeUsed('SUSTAIN_DAMAGE', variantKey)
  )
}
