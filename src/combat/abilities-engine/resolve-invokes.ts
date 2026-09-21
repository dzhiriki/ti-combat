import type { Ability, AbilityInvoke, AbilityLookupContext } from './types'

export function hasStaticInvokes(
  ability: Ability,
): ability is Ability & { invoke: AbilityInvoke[] } {
  return typeof ability.invoke !== 'function'
}

/** The ability's invoke list for `params`. Factories get a lookup context
 *  whose `this` is the ability itself. */
export function resolveInvokes(
  ability: Ability,
  params: Record<string, unknown>,
  ctx: AbilityLookupContext,
): readonly AbilityInvoke[] {
  const invoke = ability.invoke
  if (typeof invoke !== 'function') return invoke
  return invoke(params, { abilities: ctx.abilities, this: ability })
}
