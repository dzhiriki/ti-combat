import type { UnitCombatOverrides, UnitId } from '@/types'

import { CombatSideState } from '../../combat-side-state/combat-side-state'
import type { CombatStateData } from '../../combat-state/types'
import type { AbilityCallContext } from '../types'

export function commitFighters(ctx: AbilityCallContext): void {
  const space = ctx.api.own.getSpaceSurfaceId()
  const selected = ctx.api.own.system
    .getUnits('FIGHTER', { includeVariants: true })
    .filter(id => ctx.api.own.getUnitSurface(id) === space)
  if (!selected.length) return
  ctx.api.own.setUnitCategory(selected, 'GROUND_FORCES', true)
  ctx.api.own.moveUnits(selected)
  ctx.api.own.setUnitParticipation(selected, true)
  const side = ctx.state[ctx.side]
  const overrides = { ...side.unitCombat }
  for (const id of selected)
    overrides[id] = { ...overrides[id], returnAfterCombat: space }
  side.unitCombat = overrides
}

/** Resolve the committed units' return independently of the ability source.
 *  Runs after END_OF_COMBAT reactions, only when completion was not canceled. */
export function returnCommittedFighters(state: CombatStateData): void {
  for (const side of [state.attacker, state.defender]) {
    if (!side.unitCombat) continue
    const returning = Object.entries(side.unitCombat).filter(
      ([, grant]) => grant.returnAfterCombat,
    )
    if (!returning.length) continue
    const overrides = { ...side.unitCombat }
    for (const [id, grant] of returning) {
      CombatSideState.moveUnits(side, [id as UnitId], grant.returnAfterCombat!)
      const categories = { ...grant.categories }
      const next: UnitCombatOverrides = { ...grant, categories }
      delete next.returnAfterCombat
      delete next.participating
      delete categories.GROUND_FORCES
      if (!Object.keys(categories).length) delete next.categories
      if (!Object.keys(next).length) delete overrides[id]
      else overrides[id] = next
    }
    side.unitCombat = Object.keys(overrides).length ? overrides : undefined
    side._resolvedRestrictions = undefined
  }
}
