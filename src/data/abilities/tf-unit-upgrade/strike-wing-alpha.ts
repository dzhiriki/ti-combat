import type { Ability } from '@/combat'
import type { UnitType } from '@/types'

// AFB roll trigger for the Strike Wing Alpha destroyer upgrade: each natural 9
// or 10 on the destroyer's Anti-Fighter Barrage also destroys 1 of the
// opponent's infantry in the space area. Declared once for the destroyer
// variant, which covers every Strike Wing Alpha destroyer's AFB dice.
export const strikeWingAlphaAfbInvoke: Ability['invoke'][number] = {
  timing: 'BEFORE_UNIT_ABILITY_ROLL',
  context: 'AFB',
  declaration: true,
  call: ctx => {
    const [destroyer] = ctx.api.own.getUnits('DESTROYER', {
      includeVariants: true,
    })
    if (!destroyer) return
    const variantKey = (ctx.api.own.getUnitVariantKey(destroyer) ??
      'DESTROYER') as UnitType
    ctx.api.own.declareRollTrigger({
      unitType: [variantKey],
      faces: [9, 10],
      effect: (count, branchCtx) => {
        const infantry = branchCtx.api.opponent.getUnits('INFANTRY', {
          includeVariants: true,
        })
        const toDestroy = infantry.slice(0, count)
        if (toDestroy.length > 0) branchCtx.api.opponent.destroyUnits(toDestroy)
      },
    })
  },
}
