import { describe, expect, it } from 'vitest'

import type { Ability } from '@/combat'
import { buildCombatState } from '@/hooks/combat-setup/build-combat-state'

// A config ability whose invoke list depends on a param. In mode 'a' it has
// only a PREPARE invoke that flips the mode; in mode 'b' it has only a
// BEFORE_DICE_ROLL invoke. The engine must re-resolve after the param
// change so the second invoke is registered.
const switcher: Ability<{ mode: string }> = {
  key: 'SWITCHER',
  name: 'Switcher',
  params: { isEnabled: true, uses: Infinity, mode: 'a' },
  headerUI: 'isEnabled',
  invoke: (params, ctx) => {
    if (ctx.this.key !== 'SWITCHER') throw new Error('ctx.this not set')
    if (params.mode === 'a') {
      return [
        {
          timing: 'PREPARE',
          call: c => {
            c.api.own.updateAbilityConfig({ mode: 'b' })
          },
        },
      ]
    }
    return [{ timing: 'BEFORE_DICE_ROLL', call: () => {} }]
  },
}

describe('function-valued invoke', () => {
  it('is re-resolved when a param changes', () => {
    const state = buildCombatState({
      mode: 'SPACE',
      attacker: {
        faction: 'NEUTRAL',
        units: { CRUISER: 1 },
        abilities: { SWITCHER: true },
      },
      defender: { faction: 'NEUTRAL', units: { CRUISER: 1 } },
      customAbilities: [switcher],
    })
    // PREPARE ran inside buildCombatState and flipped the mode.
    expect(state.data.attacker.liveAbilities.SWITCHER?.mode).toBe('b')
    expect(
      state.params.hasCallableInvoke('BEFORE_DICE_ROLL', ['SPACE_COMBAT']),
    ).toBe(true)
    expect(
      state.params
        .getAbilityKeysForTiming('attacker', 'BEFORE_DICE_ROLL')
        .map(a => a.key),
    ).toContain('SWITCHER')
  })

  it('registers nothing when the factory returns an empty list', () => {
    const empty: Ability = {
      key: 'EMPTY',
      name: 'Empty',
      params: { isEnabled: true, uses: Infinity },
      headerUI: 'isEnabled',
      invoke: () => [],
    }
    const state = buildCombatState({
      mode: 'SPACE',
      attacker: {
        faction: 'NEUTRAL',
        units: { CRUISER: 1 },
        abilities: { EMPTY: true },
      },
      defender: { faction: 'NEUTRAL', units: { CRUISER: 1 } },
      customAbilities: [empty],
    })
    expect(
      state.params
        .getAbilityKeysForTiming('attacker', 'BEFORE_DICE_ROLL')
        .map(a => a.key),
    ).not.toContain('EMPTY')
  })
})
