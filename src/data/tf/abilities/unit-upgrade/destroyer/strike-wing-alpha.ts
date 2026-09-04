import argentFlightIcon from '@/assets/faction/argent_flight.svg?raw'
import type { Ability, AbilityInvoke } from '@/combat'
import { janovetInherits } from '@/data/tf/faction/el_nen_janovet/faces-of-janovet'
import type { UnitType } from '@/types'

import { createTfUnitUpgrade } from '../create-tf-unit-upgrade'

// AFB roll trigger for the Strike Wing Alpha destroyer upgrade: each natural 9
// or 10 on the destroyer's Anti-Fighter Barrage also destroys 1 of the
// opponent's infantry in the space area. Declared once for the destroyer
// variant, which covers every Strike Wing Alpha destroyer's AFB dice. The
// Faces of Janovet inherits the text ability, so its flagship's AFB dice
// (gained from the same card) trigger too.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const strikeWingAlphaAfbInvoke: AbilityInvoke<any> = {
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

export const strikeWingAlpha: Ability = createTfUnitUpgrade({
  key: 'TF_UPGRADE_STRIKE_WING_ALPHA',
  icon: argentFlightIcon,
  name: 'Strike Wing Alpha',
  description:
    "When this unit uses Anti-Fighter Barrage, each result of 9 or 10 also destroys 1 of your opponent's infantry in the space area of the active system.",
  unitType: 'DESTROYER',
  cost: 1,
  combat: [7, 1],
  move: 2,
  capacity: 1,
  afb: [6, 3],
  invokes: [strikeWingAlphaAfbInvoke],
})
