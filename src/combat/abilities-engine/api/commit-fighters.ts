import { type CombatSide, SPACE_SURFACE_ID, type UnitId } from '@/types'

import { CombatSideState } from '../../combat-side-state/combat-side-state'
import type { CombatStateData } from '../../combat-state/types'
import type { AbilityCallContext } from '../types'

/** Matriarch/Morphwing: fighters in space join the invasion as ground forces.
 *  `_commitUnits` lands them on the planet with the native ground forces. */
export function commitFighters(ctx: AbilityCallContext): void {
  const fighters = ctx.api.own.system
    .getUnits('FIGHTER', { includeVariants: true })
    .filter(id => ctx.api.own.getUnitSurface(id) === SPACE_SURFACE_ID)
  ctx.api.own.grantCategory(fighters, 'GROUND_FORCES')
}

/** Return committed fighters to space once combat ends, even if their source
 *  died. Returns the sides whose units moved, so callers resync only those. */
export function returnCommittedFighters(state: CombatStateData): CombatSide[] {
  const moved: CombatSide[] = []
  for (const sideKey of ['attacker', 'defender'] as const) {
    const side = state[sideKey]
    const grants = side.unitGrants
    if (!grants) continue
    const next = { ...grants }
    const returning: UnitId[] = []
    for (const id in grants) {
      if (grants[id] !== 'GROUND_FORCES') continue
      returning.push(id as UnitId)
      delete next[id]
    }
    if (!returning.length) continue
    side.unitGrants = Object.keys(next).length ? next : undefined
    CombatSideState.moveUnits(side, returning, SPACE_SURFACE_ID)
    moved.push(sideKey)
  }
  return moved
}
