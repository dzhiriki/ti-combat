import { hasStaticInvokes } from './resolve-invokes'
import type { Ability } from './types'

/** Clone an ability with optional overrides. Static invoke entries receive
 * fresh identities because invocation tracking uses object identity. */
export function cloneAbility(
  ability: Ability,
  overrides: Partial<Ability> = {},
): Ability {
  return {
    ...ability,
    invoke: hasStaticInvokes(ability)
      ? ability.invoke.map(invoke => ({ ...invoke }))
      : ability.invoke,
    ...overrides,
  }
}
