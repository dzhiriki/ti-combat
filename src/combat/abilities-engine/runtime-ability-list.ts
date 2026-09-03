import type { CombatSide } from '@/types'

import type { AbilitySlot } from './ability-slot'
import type {
  Ability,
  OwnOpponentContext,
  RegisteredAbility,
  RuntimeAbilityList,
} from './types'

/** Build a per-side lookup over a deduped ability list. `get(slot)` filters
 *  lazily and caches per slot, so repeated UI/engine reads share one array. */
export function createRuntimeAbilityList(
  abilities: readonly Ability[],
  slots: ReadonlyMap<string, AbilitySlot>,
): RuntimeAbilityList {
  const bySlot = new Map<AbilitySlot, readonly Ability[]>()
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

/** Dedupe a registered list by key, keeping the first slot per key — the
 *  same rule as the engine's `dedupeRegistered`. */
export function createRuntimeAbilityListFromRegistered(
  registered: readonly RegisteredAbility[],
): RuntimeAbilityList {
  const abilities: Ability[] = []
  const slots = new Map<string, AbilitySlot>()
  for (const r of registered) {
    if (slots.has(r.ability.key)) continue
    slots.set(r.ability.key, r.slot)
    abilities.push(r.ability)
  }
  return createRuntimeAbilityList(abilities, slots)
}

/** Own/opponent lookups for both sides, built from the registered lists
 *  alone — usable before an engine exists (reconcile, worker setup). */
export function createLookups(
  registered: Record<CombatSide, readonly RegisteredAbility[]>,
): Record<CombatSide, OwnOpponentContext<RuntimeAbilityList>> {
  const attacker = createRuntimeAbilityListFromRegistered(registered.attacker)
  const defender = createRuntimeAbilityListFromRegistered(registered.defender)
  return {
    attacker: { own: attacker, opponent: defender },
    defender: { own: defender, opponent: attacker },
  }
}
