import type { CombatSide, UnitId, UnitType } from '@/types'

import type { SlotId } from './types'

export interface PendingEffect {
  kind: 'rollTrigger'
  abilityKey: string
  slotId: SlotId
  side: CombatSide
  payload: unknown
}

/** Math-kernel output per side: base hits (from dice rolls into the
 *  main pool — unrestricted), plus any custom sub-pools. Custom entries
 *  come from ADDITIONAL_HIT_POOL transforms (e.g. [0.0.1]) and from
 *  unit-ability rolls whose resolved priority restricts the landing
 *  side's possible targets. `additional` is not produced by the kernel —
 *  abilities feed it via the public API after the dice land. */
export interface PendingHitPool {
  base: number
  custom: { key: string; base: number; unitPriority: UnitType[] }[]
}

export interface DiceMathBranch {
  probability: number
  pendingHitPool: { attacker: PendingHitPool; defender: PendingHitPool }
  usesDelta: Map<string, number>
  destroyedUnits: Set<UnitId>
  pendingEffects: PendingEffect[]
}

export function makeEmptyPendingHitPool(): PendingHitPool {
  return { base: 0, custom: [] }
}
