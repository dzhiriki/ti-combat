import { describe, expect, it } from 'vitest'

import {
  createDefaultSurfaces,
  SPACE_SURFACE_ID,
  type UnitBaseType,
  type UnitId,
  type UnitIdList,
  type UnitStats,
} from '@/types'

import { CombatState } from '../combat-state/combat-state'
import type { CombatStateData, SideStateData } from '../combat-state/types'
import { nextUnitIds } from '../utils/unit-id'
import { parseVariantId } from '../utils/unit-variant'
import { AbilitiesEngine } from './abilities-engine'
import type { Ability, AbilityCallContext } from './types'

// Shared across all `buildSide` calls so attacker/defender IDs don't
// collide within a single test setup. Equivalent to the old module-level
// counter — tests don't exercise branching convergence, so monotonically
// advancing across tests is fine.
const idGen: { _nextCode?: number } = {}

const SPACE_COMBAT_SURFACES = {
  surfaces: createDefaultSurfaces(),
  activeSurfaceId: SPACE_SURFACE_ID,
}

/** Helper to build compact SideStateData from unit specs */
function buildSide(
  faction: SideStateData['faction'],
  unitSpecs: Record<string, { count: number; stats: UnitStats }>,
): SideStateData {
  let participatingUnits = ''
  const unitType: SideStateData['unitType'] = {}
  const unitStats = {} as SideStateData['unitStats']
  const unitSurface: SideStateData['unitSurface'] = {}
  for (const [key, spec] of Object.entries(unitSpecs)) {
    const k = key as import('@/types').UnitType
    const ids = nextUnitIds(spec.count, idGen)
    for (const id of ids) {
      participatingUnits += id
      unitType[id] = k
      unitSurface[id] = 'space' as import('@/types').SurfaceId
    }
    unitStats[k] = spec.stats
  }
  return {
    faction,
    participatingUnits: participatingUnits as UnitIdList,
    nonParticipatingUnits: '' as UnitIdList,
    surfaceUnits: { space: participatingUnits as UnitIdList },
    unitSurface,
    unitType,
    unitState: {},
    unitStats,
    abilities: {},
    liveAbilities: {},
  }
}

const emptySide = (
  faction: SideStateData['faction'] = 'FEDERATION_OF_SOL',
): SideStateData => ({
  faction,
  participatingUnits: '' as UnitIdList,
  nonParticipatingUnits: '' as UnitIdList,
  surfaceUnits: { space: '' as UnitIdList },
  unitSurface: {},
  unitType: {},
  unitState: {},
  unitStats: {} as SideStateData['unitStats'],
  abilities: {},
  liveAbilities: {},
})

function unitsByBaseType(
  sideData: SideStateData,
): Partial<Record<UnitBaseType, UnitId[]>> {
  const result: Partial<Record<UnitBaseType, UnitId[]>> = {}
  const collect = (pool: UnitIdList) => {
    for (const id of pool) {
      const key = sideData.unitType[id]
      if (!key) continue
      const { type } = parseVariantId(key)
      const arr = result[type] ?? (result[type] = [])
      arr.push(id as UnitId)
    }
  }
  collect(sideData.participatingUnits)
  collect(sideData.nonParticipatingUnits)
  return result
}

/** Fire a timing at the engine and drain any script steps it queued
 *  (e.g. destroy-cascade groups pushed by `destroyUnits`). Mirrors how
 *  the real combat engine pumps `advance()` between runAbilities passes. */
function runAndDrain(cs: CombatState, timing: 'START_OF_COMBAT_ROUND'): void {
  cs.params.runAbilities(timing)
  while (cs.pendingSteps.length > 0) {
    const outcomes = cs.advance()
    if (outcomes.length !== 1 || outcomes[0].probability !== 1) break
  }
}

describe('collectUnitAbilities', () => {
  it('should collect abilities from units on the field', () => {
    const mockAbility: Ability = {
      key: 'TEST_UNIT_ABILITY',
      name: 'Test Unit Ability',
      params: { isEnabled: true, uses: Infinity },
      invoke: [],
    }

    const state: CombatStateData = {
      attacker: buildSide('SARDAKK_NORR', {
        FLAGSHIP: {
          count: 2,
          stats: {
            COMBAT: [6, 2],
            UNIT_ABILITIES: {},
            ABILITIES: [mockAbility],
          },
        },
      }),
      defender: emptySide(),
      combatMode: 'SPACE',
      ...SPACE_COMBAT_SURFACES,
    }

    const result = AbilitiesEngine.collectUnitAbilities(state, 'attacker')

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({
      ability: mockAbility,
      unitType: 'FLAGSHIP',
    })
    expect(result[1]).toMatchObject({
      ability: mockAbility,
      unitType: 'FLAGSHIP',
    })
    // Each entry should have a unique UnitId
    expect(result[0].unitId).not.toBe(result[1].unitId)
  })

  it('should return empty array when no units have abilities', () => {
    const state: CombatStateData = {
      attacker: buildSide('SARDAKK_NORR', {
        CRUISER: { count: 1, stats: { COMBAT: [7, 1], UNIT_ABILITIES: {} } },
      }),
      defender: emptySide(),
      combatMode: 'SPACE',
      ...SPACE_COMBAT_SURFACES,
    }

    const result = AbilitiesEngine.collectUnitAbilities(state, 'attacker')

    expect(result).toHaveLength(0)
  })

  it('should handle units with multiple abilities', () => {
    const ability1: Ability = {
      key: 'ABILITY_1',
      name: 'Ability 1',
      params: { isEnabled: true, uses: Infinity },
      invoke: [],
    }
    const ability2: Ability = {
      key: 'ABILITY_2',
      name: 'Ability 2',
      params: { isEnabled: true, uses: Infinity },
      invoke: [],
    }

    const state: CombatStateData = {
      attacker: buildSide('SARDAKK_NORR', {
        FLAGSHIP: {
          count: 1,
          stats: {
            COMBAT: [6, 2],
            UNIT_ABILITIES: {},
            ABILITIES: [ability1, ability2],
          },
        },
      }),
      defender: emptySide(),
      combatMode: 'SPACE',
      ...SPACE_COMBAT_SURFACES,
    }

    const result = AbilitiesEngine.collectUnitAbilities(state, 'attacker')

    expect(result).toHaveLength(2)
    expect(result[0].ability).toBe(ability1)
    expect(result[1].ability).toBe(ability2)
  })
})

describe('unit ability invocation', () => {
  it('should invoke unit ability once per unit', () => {
    const invokeCalls: string[] = []
    const mockAbility: Ability = {
      key: 'TEST_UNIT_ABILITY',
      name: 'Test',
      params: { isEnabled: true, uses: Infinity },
      invoke: [
        {
          timing: 'START_OF_COMBAT_ROUND',
          call: () => {
            invokeCalls.push('called')
          },
        },
      ],
    }

    const state: CombatStateData = {
      attacker: buildSide('SARDAKK_NORR', {
        FLAGSHIP: {
          count: 2,
          stats: {
            COMBAT: [6, 2],
            UNIT_ABILITIES: {},
            ABILITIES: [mockAbility],
          },
        },
      }),
      defender: emptySide(),
      combatMode: 'SPACE',
      ...SPACE_COMBAT_SURFACES,
    }

    runAndDrain(CombatState.fromDataStandalone(state), 'START_OF_COMBAT_ROUND')

    expect(invokeCalls).toHaveLength(2)
  })
})

describe('AFTER_DESTROY triggered by destroyUnits', () => {
  it('should trigger AFTER_DESTROY when an ability destroys units', () => {
    const afterDestroyCalls: UnitId[][] = []

    const destroyAbility: Ability = {
      key: 'DESTROY_ABILITY',
      name: 'Destroy',
      params: { isEnabled: true, uses: Infinity },
      invoke: [
        {
          timing: 'START_OF_COMBAT_ROUND',
          call: (ctx: AbilityCallContext) => {
            ctx.api.opponent.destroyUnits('FIGHTER')
          },
        },
      ],
    }

    const afterDestroyAbility: Ability = {
      key: 'AFTER_DESTROY_HANDLER',
      name: 'After Destroy',
      params: { isEnabled: true, uses: Infinity },
      invoke: [
        {
          timing: 'AFTER_DESTROY',
          call: (
            _ctx: AbilityCallContext,
            _params: Record<string, never>,
            ids: UnitId[],
          ) => {
            afterDestroyCalls.push(ids)
          },
        },
      ],
    }

    const state: CombatStateData = {
      attacker: buildSide('SARDAKK_NORR', {
        CRUISER: {
          count: 1,
          stats: {
            COMBAT: [7, 1],
            UNIT_ABILITIES: {},
            ABILITIES: [destroyAbility],
          },
        },
      }),
      defender: buildSide('FEDERATION_OF_SOL', {
        FIGHTER: {
          count: 1,
          stats: {
            COMBAT: [9, 1],
            UNIT_ABILITIES: {},
            ABILITIES: [afterDestroyAbility],
          },
        },
      }),
      combatMode: 'SPACE',
      ...SPACE_COMBAT_SURFACES,
    }

    runAndDrain(CombatState.fromDataStandalone(state), 'START_OF_COMBAT_ROUND')

    // Fighter should be destroyed
    expect(unitsByBaseType(state.defender).FIGHTER).toBeUndefined()
    // AFTER_DESTROY should have been called (from the destroyed fighter's ability)
    expect(afterDestroyCalls).toHaveLength(1)
    // Exactly one destroyed unit id was reported
    expect(afterDestroyCalls[0]).toHaveLength(1)
  })

  it('should NOT trigger AFTER_DESTROY when no units are destroyed', () => {
    const afterDestroyCalls: unknown[] = []

    const noopAbility: Ability = {
      key: 'NOOP_ABILITY',
      name: 'Noop',
      params: { isEnabled: true, uses: Infinity },
      invoke: [
        {
          timing: 'START_OF_COMBAT_ROUND',
          call: () => {
            // Does nothing - no units destroyed
          },
        },
      ],
    }

    const afterDestroyAbility: Ability = {
      key: 'AFTER_DESTROY_HANDLER',
      name: 'After Destroy',
      params: { isEnabled: true, uses: Infinity },
      invoke: [
        {
          timing: 'AFTER_DESTROY',
          call: () => {
            afterDestroyCalls.push('called')
          },
        },
      ],
    }

    const state: CombatStateData = {
      attacker: buildSide('SARDAKK_NORR', {
        CRUISER: {
          count: 1,
          stats: {
            COMBAT: [7, 1],
            UNIT_ABILITIES: {},
            ABILITIES: [noopAbility, afterDestroyAbility],
          },
        },
      }),
      defender: buildSide('FEDERATION_OF_SOL', {
        FIGHTER: { count: 1, stats: { COMBAT: [9, 1], UNIT_ABILITIES: {} } },
      }),
      combatMode: 'SPACE',
      ...SPACE_COMBAT_SURFACES,
    }

    runAndDrain(CombatState.fromDataStandalone(state), 'START_OF_COMBAT_ROUND')

    expect(afterDestroyCalls).toHaveLength(0)
  })

  it('should NOT recursively trigger AFTER_DESTROY from AFTER_DESTROY handlers', () => {
    const afterDestroyCalls: unknown[] = []

    const destroyAbility: Ability = {
      key: 'DESTROY_ABILITY',
      name: 'Destroy',
      params: { isEnabled: true, uses: Infinity },
      invoke: [
        {
          timing: 'START_OF_COMBAT_ROUND',
          call: (ctx: AbilityCallContext) => {
            ctx.api.opponent.destroyUnits('FIGHTER')
          },
        },
      ],
    }

    // This AFTER_DESTROY handler also destroys a unit — should NOT trigger another AFTER_DESTROY
    const afterDestroyAbility: Ability = {
      key: 'CHAIN_DESTROY',
      name: 'Chain Destroy',
      params: { isEnabled: true, uses: Infinity },
      invoke: [
        {
          timing: 'AFTER_DESTROY',
          isCallable: (_params, ctx, ids) => ids.includes(ctx.getUnit()),
          call: (ctx: AbilityCallContext) => {
            afterDestroyCalls.push('called')
            // From defender's FIGHTER perspective, own = defender side
            ctx.api.own.destroyUnits('CRUISER')
          },
        },
      ],
    }

    const state: CombatStateData = {
      attacker: buildSide('SARDAKK_NORR', {
        FLAGSHIP: {
          count: 1,
          stats: {
            COMBAT: [6, 2],
            UNIT_ABILITIES: {},
            ABILITIES: [destroyAbility],
          },
        },
      }),
      defender: buildSide('FEDERATION_OF_SOL', {
        FIGHTER: {
          count: 1,
          stats: {
            COMBAT: [9, 1],
            UNIT_ABILITIES: {},
            ABILITIES: [afterDestroyAbility],
          },
        },
        CRUISER: { count: 1, stats: { COMBAT: [7, 1], UNIT_ABILITIES: {} } },
      }),
      combatMode: 'SPACE',
      ...SPACE_COMBAT_SURFACES,
    }

    runAndDrain(CombatState.fromDataStandalone(state), 'START_OF_COMBAT_ROUND')

    // Both units should be destroyed
    expect(unitsByBaseType(state.defender).FIGHTER).toBeUndefined()
    expect(unitsByBaseType(state.defender).CRUISER).toBeUndefined()
    // AFTER_DESTROY handler should only be called once (no recursion)
    expect(afterDestroyCalls).toHaveLength(1)
  })
})

describe('merged START_OF_COMBAT bucket', () => {
  it('fires both START_OF_COMBAT and START_OF_COMBAT_ROUND abilities from a single call', () => {
    const calls: string[] = []

    const startOfCombatAbility: Ability = {
      key: 'START_COMBAT_ABILITY',
      name: 'Start Combat',
      params: { isEnabled: true, uses: Infinity },
      invoke: [
        {
          timing: 'START_OF_COMBAT',
          call: () => {
            calls.push('START_OF_COMBAT')
          },
        },
      ],
    }

    const startOfRoundAbility: Ability = {
      key: 'START_ROUND_ABILITY',
      name: 'Start Round',
      params: { isEnabled: true, uses: Infinity },
      invoke: [
        {
          timing: 'START_OF_COMBAT_ROUND',
          call: () => {
            calls.push('START_OF_COMBAT_ROUND')
          },
        },
      ],
    }

    const state: CombatStateData = {
      attacker: buildSide('SARDAKK_NORR', {
        CRUISER: {
          count: 1,
          stats: {
            COMBAT: [7, 1],
            UNIT_ABILITIES: {},
            ABILITIES: [startOfCombatAbility, startOfRoundAbility],
          },
        },
      }),
      defender: emptySide(),
      combatMode: 'SPACE',
      ...SPACE_COMBAT_SURFACES,
    }

    CombatState.fromDataStandalone(state).params.runAbilities('START_OF_COMBAT')

    expect(calls).toContain('START_OF_COMBAT')
    expect(calls).toContain('START_OF_COMBAT_ROUND')
    expect(calls).toHaveLength(2)
  })

  it('should work with a single timing (non-array)', () => {
    const calls: string[] = []

    const ability: Ability = {
      key: 'SINGLE_TIMING',
      name: 'Single',
      params: { isEnabled: true, uses: Infinity },
      invoke: [
        {
          timing: 'START_OF_COMBAT_ROUND',
          call: () => {
            calls.push('called')
          },
        },
      ],
    }

    const state: CombatStateData = {
      attacker: buildSide('SARDAKK_NORR', {
        CRUISER: {
          count: 1,
          stats: { COMBAT: [7, 1], UNIT_ABILITIES: {}, ABILITIES: [ability] },
        },
      }),
      defender: emptySide(),
      combatMode: 'SPACE',
      ...SPACE_COMBAT_SURFACES,
    }

    runAndDrain(CombatState.fromDataStandalone(state), 'START_OF_COMBAT_ROUND')

    expect(calls).toHaveLength(1)
  })
})
