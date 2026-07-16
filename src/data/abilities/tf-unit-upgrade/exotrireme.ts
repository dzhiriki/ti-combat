import type { Ability, AbilityReadContext } from '@/combat'
import { UNIT_WORTH } from '@/constants/units'
import type { UnitId, UnitType } from '@/types'

// Opponent ships, highest-worth first — the best targets for Exotrireme's
// self-destruct.
function enemyShipsByWorth(ctx: AbilityReadContext): UnitId[] {
  const { ships } = ctx.api.opponent.getAbilityConfig('SETTINGS')
  const scored: { id: UnitId; worth: number }[] = []
  for (const shipType of ships) {
    for (const id of ctx.api.opponent.getUnits(shipType as UnitType, {
      includeVariants: true,
    })) {
      const base = ctx.api.opponent.getUnitBaseType(id)
      scored.push({ id, worth: base ? (UNIT_WORTH[base] ?? 0) : 0 })
    }
  }
  return scored.sort((a, b) => b.worth - a.worth).map(x => x.id)
}

// After a round of space combat, sacrifice one Exotrireme dreadnought to destroy
// up to 2 of the opponent's ships. Opt-in (the `selfDestruct` checkbox) and
// once per combat (`_exoDone`).
export const exotriremeSelfDestructInvoke: Ability['invoke'][number] = {
  timing: 'AFTER_COMBAT_ROUND',
  context: 'SPACE_COMBAT',
  isCallable: (params, ctx) => {
    if (!params.selfDestruct || params._exoDone) return false
    const hasDread =
      ctx.api.own.getUnits('DREADNOUGHT', { includeVariants: true }).length > 0
    if (!hasDread) return false
    return enemyShipsByWorth(ctx).length > 0
  },
  call: ctx => {
    ctx.api.own.updateAbilityConfig({ _exoDone: true })
    const targets = enemyShipsByWorth(ctx).slice(0, 2)
    if (targets.length > 0) ctx.api.opponent.destroyUnits(targets)
    const [dread] = ctx.api.own.getUnits('DREADNOUGHT', {
      includeVariants: true,
    })
    if (dread) ctx.api.own.destroyUnits(dread)
  },
}
