import type { Ability } from '@/combat'
import { janovetInherits } from '@/data/faction/el_nen_janovet/faces-of-janovet'
import type { UnitType } from '@/types'

// AFB roll trigger for the Strike Wing Alpha destroyer upgrade: each natural 9
// or 10 on the destroyer's Anti-Fighter Barrage also destroys 1 of the
// opponent's infantry in the space area. Declared once for the destroyer
// variant, which covers every Strike Wing Alpha destroyer's AFB dice. The
// Faces of Janovet inherits the text ability, so its flagship's AFB dice
// (gained from the same card) trigger too.
export const strikeWingAlphaAfbInvoke: Ability['invoke'][number] = {
  timing: 'BEFORE_UNIT_ABILITY_ROLL',
  context: 'AFB',
  declaration: true,
  call: ctx => {
    const unitTypes: UnitType[] = []
    const [destroyer] = ctx.api.own.getUnits('DESTROYER', {
      includeVariants: true,
    })
    if (destroyer) {
      unitTypes.push(
        (ctx.api.own.getUnitVariantKey(destroyer) ?? 'DESTROYER') as UnitType,
      )
    }
    if (janovetInherits(ctx.api.own, 'TF_UPGRADE_STRIKE_WING_ALPHA')) {
      const [flagship] = ctx.api.own.getUnits('FLAGSHIP', {
        includeVariants: true,
      })
      if (flagship) {
        unitTypes.push(
          (ctx.api.own.getUnitVariantKey(flagship) ?? 'FLAGSHIP') as UnitType,
        )
      }
    }
    if (unitTypes.length === 0) return
    ctx.api.own.declareRollTrigger({
      unitType: unitTypes,
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
