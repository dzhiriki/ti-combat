import { describe, expect, it } from 'vitest'

import type { Ability } from '@/combat'

import { combatTest } from '../utils/combat-test'

/**
 * Engine test: verify that WHEN_DESTROY fires on unit destruction
 * (via destroyUnits) but NOT on unit removal (via removeUnits).
 */

let whenDestroyFired = false

const destroyOpponentCruiser: Ability = {
  key: 'TEST_DESTROY_CRUISER',
  name: 'Test Destroy Cruiser',
  params: { isEnabled: false, uses: 1 },
  invoke: [
    {
      timing: 'START_OF_COMBAT_ROUND',
      isCallable: (_params, ctx) =>
        ctx.api.opponent.surface.hasUnitType('CRUISER', {
          includeVariants: false,
        }),
      call: ctx => {
        ctx.api.opponent.destroyUnits('CRUISER')
      },
    },
  ],
}

const removeOpponentCruiser: Ability = {
  key: 'TEST_REMOVE_CRUISER',
  name: 'Test Remove Cruiser',
  params: { isEnabled: false, uses: 1 },
  invoke: [
    {
      timing: 'START_OF_COMBAT_ROUND',
      isCallable: (_params, ctx) =>
        ctx.api.opponent.surface.hasUnitType('CRUISER', {
          includeVariants: false,
        }),
      call: ctx => {
        ctx.api.opponent.removeUnits('CRUISER')
      },
    },
  ],
}

const reactToDestroy: Ability = {
  key: 'TEST_REACT_DESTROY',
  name: 'Test React to Destroy',
  params: { isEnabled: false, uses: Infinity },
  invoke: [
    {
      timing: 'WHEN_DESTROY',
      isCallable: (_params, _ctx, ids) => ids.length > 0,
      call: () => {
        whenDestroyFired = true
      },
    },
  ],
}

describe('engine: destroy vs remove', () => {
  beforeEach(() => {
    whenDestroyFired = false
  })

  it('WHEN_DESTROY fires when destroyUnits is called', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: { TEST_DESTROY_CRUISER: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: { TEST_REACT_DESTROY: true },
      },
      customAbilities: [destroyOpponentCruiser, reactToDestroy],
    })

    t.advanceTo('SPACE_COMBAT')

    t.advanceRound()

    expect(whenDestroyFired).toBe(true)
    expect(t.abilityLog('TEST_REACT_DESTROY')).not.toHaveLength(0)
    expect(t.defender.units.CRUISER).toBeUndefined()
  })

  it('WHEN_DESTROY does NOT fire when removeUnits is called', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: { TEST_REMOVE_CRUISER: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 1 },
        abilities: { TEST_REACT_DESTROY: true },
      },
      customAbilities: [removeOpponentCruiser, reactToDestroy],
    })

    t.advanceTo('SPACE_COMBAT')

    t.advanceRound()

    expect(whenDestroyFired).toBe(false)
    expect(t.abilityLog('TEST_REACT_DESTROY')).toHaveLength(0)
    expect(t.defender.units.CRUISER).toBeUndefined()
  })
})
