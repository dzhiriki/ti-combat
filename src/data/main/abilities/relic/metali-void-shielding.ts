import type { Ability, AbilityReadContext } from '@/combat'
import type { UnitId } from '@/types'

export const metaliVoidShielding: Ability = {
  key: 'METALI_VOID_SHIELDING',
  name: 'Metali Void Shielding',
  description:
    'Each time hits are produced against 1 or more of your non-fighter ships, 1 of those ships may use Sustain Damage as if it had that ability.',
  context: 'SPACE',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'BEFORE_ASSIGN_HITS',
      isCallable: (_params, ctx) => {
        if (ctx.api.own.getPendingHits() <= 0) return false
        return findVoidShieldTarget(ctx) !== undefined
      },
      call: ctx => {
        const target = findVoidShieldTarget(ctx)
        if (!target) return

        ctx.api.own.modifyUnitState(target, { isDamaged: true })
        ctx.api.own.reduceHits(1)
        ctx.logger?.log(ctx.api.own.getUnitVariantKey(target))
        // Triggered steps pop LIFO — push AFTER first so WHEN runs first.
        ctx.trigger('AFTER_SUSTAIN_DAMAGE_USE', target)
        ctx.trigger('WHEN_SUSTAIN_DAMAGE_USE', target)
      },
    },
  ],
}

function findVoidShieldTarget(ctx: AbilityReadContext): UnitId | undefined {
  const sustainConfig = ctx.api.own.getAbilityConfig('SUSTAIN_DAMAGE')
  const priority = sustainConfig?.spacePriority ?? []

  const validTargets = ctx.api.own.getHitPoolValidTargets()
  const validTargetSet = validTargets ? new Set(validTargets) : null

  const target = ctx.api.own.findUnitByPriority(ctx.utils.getFlat(priority), {
    includeVariants: false,
    predicate: (variant, unitId) => {
      if (validTargetSet && !validTargetSet.has(variant)) return false
      if (ctx.api.own.isUnitAbilityCannotBeUsed('SUSTAIN_DAMAGE', variant)) {
        return false
      }
      // Ignore units that don't have sustain because it lost
      if (ctx.api.own.isUnitAbilityLost('SUSTAIN_DAMAGE', variant)) {
        return false
      }

      if (ctx.api.own.getUnitState(unitId)?.isDamaged) return false
      return true
    },
  })

  return target
}
