import type { CombatSide } from '@/types'

import type {
  OwnOpponentContext,
  RegisteredAbility,
  RuntimeAbilityList,
} from './types'

/** Build a per-side lookup over a side's registered list. `get(slot)` filters
 *  lazily and caches per slot, so repeated UI/engine reads share one array. */
export function createRuntimeAbilityList(
  abilities: readonly RegisteredAbility[],
): RuntimeAbilityList {
  const bySlot = new Map<string, readonly RegisteredAbility[]>()
  return {
    all: abilities,
    get(slot) {
      let list = bySlot.get(slot)
      if (list === undefined) {
        list = abilities.filter(a => a.slot === slot)
        bySlot.set(slot, list)
      }
      return list
    },
  }
}

/** Own/opponent lookups for both sides, built from the registered lists
 *  alone — usable before an engine exists (reconcile, worker setup). */
export function createLookups(
  registered: Record<CombatSide, readonly RegisteredAbility[]>,
): Record<CombatSide, OwnOpponentContext<RuntimeAbilityList>> {
  const attacker = createRuntimeAbilityList(registered.attacker)
  const defender = createRuntimeAbilityList(registered.defender)
  return {
    attacker: { own: attacker, opponent: defender },
    defender: { own: defender, opponent: attacker },
  }
}
