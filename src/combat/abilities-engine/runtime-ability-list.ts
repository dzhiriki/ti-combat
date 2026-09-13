import type { CollectedAbility, CombatSide } from '@/types'

import type { Ability, OwnOpponentContext, RuntimeAbilityList } from './types'

/** Build a per-side lookup over a deduped ability list. `get(slot)` filters
 *  lazily and caches per slot, so repeated UI/engine reads share one array. */
export function createRuntimeAbilityList(
  abilities: readonly Ability[],
  slots: ReadonlyMap<string, string>,
): RuntimeAbilityList {
  const bySlot = new Map<string, readonly Ability[]>()
  return {
    all: abilities,
    get(slot) {
      let list = bySlot.get(slot)
      if (list === undefined) {
        list = abilities.filter(a => slots.get(a.key) === slot)
        bySlot.set(slot, list)
      }
      return list
    },
  }
}

export function createRuntimeAbilityListFromRegistered(
  registered: readonly CollectedAbility[],
): RuntimeAbilityList {
  return createRuntimeAbilityList(
    registered.map(r => r.ability),
    new Map(registered.map(r => [r.ability.key, r.slot])),
  )
}

/** Own/opponent lookups for both sides, built from the registered lists
 *  alone — usable before an engine exists (reconcile, worker setup). */
export function createLookups(
  registered: Record<CombatSide, readonly CollectedAbility[]>,
): Record<CombatSide, OwnOpponentContext<RuntimeAbilityList>> {
  const attacker = createRuntimeAbilityListFromRegistered(registered.attacker)
  const defender = createRuntimeAbilityListFromRegistered(registered.defender)
  return {
    attacker: { own: attacker, opponent: defender },
    defender: { own: defender, opponent: attacker },
  }
}
