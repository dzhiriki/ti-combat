import type { Ability } from '@/combat'
import type { AbilityLayoutContext } from '@/types'

import { abilityOrder } from './ability-order'
import { antiFighterBarrage } from './anti-fighter-barrage'
import { bombardment } from './bombardment'
import { capacity } from './capacity'
import { commitGroundForces } from './commit-ground-forces'
import { fleetPool } from './fleet-pool'
import { retreat } from './retreat'
import { spaceCannonDefense } from './space-cannon-defense'
import { spaceCannonOffense } from './space-cannon-offense'

/** Drivers whose settings split units between planets. */
const planetSplits: readonly Ability[] = [bombardment, commitGroundForces]

/** Where the ADVANCED drivers register: with several planets the split
 *  settings matter, so those drivers join GENERAL after its own abilities. */
export function layoutPlanetSplits(
  context: AbilityLayoutContext,
  general: readonly Ability[],
): { GENERAL: readonly Ability[]; ADVANCED: readonly Ability[] } {
  if (context.planets < 2) return { GENERAL: general, ADVANCED: advanced }
  return {
    GENERAL: [...general, ...planetSplits],
    ADVANCED: advanced.filter(ability => !planetSplits.includes(ability)),
  }
}

const advanced: readonly Ability[] = [
  abilityOrder,
  fleetPool,
  capacity,
  retreat,
  spaceCannonOffense,
  spaceCannonDefense,
  antiFighterBarrage,
  bombardment,
  commitGroundForces,
]

export default advanced
